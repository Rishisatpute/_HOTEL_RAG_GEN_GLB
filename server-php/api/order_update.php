<?php
// PATCH /api/order_update.php?id=EP1A2B3C4D5   { status: "preparing" }
//                                                { notes: "no onions" }
//                                                { assignedWaiter: "Rahul" }
//                                                { items: [{name,price,qty,special}, ...] } — waiter edit
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/orders_repo.php';
require_once __DIR__ . '/../includes/menu_lookup.php';
require_once __DIR__ . '/../includes/tickets.php';

api_bootstrap();

if ($_SERVER['REQUEST_METHOD'] !== 'PATCH') json_error('Method not allowed', 405);

$id = $_GET['id'] ?? '';
if (!$id) json_error('id is required');

$patch = body();

$existsStmt = db()->prepare('SELECT id FROM orders WHERE id = ?');
$existsStmt->execute([$id]);
if (!$existsStmt->fetch()) json_error('Order not found', 404);

$now = (int) (microtime(true) * 1000);

// items: a waiter editing the order from the menu page (add dishes, drop
// dishes, change quantities). Replaces order_items wholesale. Whatever grew
// — a brand-new dish, or an existing one's quantity going up — gets a fresh
// kitchen/bar ticket printed as an addition so the kitchen actually sees
// it. The order's status is deliberately left untouched either way; editing
// a Ready/Delivered order doesn't silently reopen it.
if (array_key_exists('items', $patch)) {
    $items = $patch['items'];
    if (!$items) json_error('Order must have at least one item');

    $oldStmt = db()->prepare('SELECT name, qty FROM order_items WHERE order_id = ?');
    $oldStmt->execute([$id]);
    $oldQtyByName = [];
    foreach ($oldStmt->fetchAll() as $row) {
        $oldQtyByName[$row['name']] = ($oldQtyByName[$row['name']] ?? 0) + (int) $row['qty'];
    }

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM order_items WHERE order_id = ?')->execute([$id]);

        $itemStmt = $pdo->prepare('INSERT INTO order_items (order_id, name, price, qty, special, print_station)
                                    VALUES (?, ?, ?, ?, ?, ?)');
        foreach ($items as $it) {
            $station = print_station_for($it['name']);
            $itemStmt->execute([$id, $it['name'], $it['price'], $it['qty'] ?? 1, !empty($it['special']) ? 1 : 0, $station]);
        }

        $pdo->prepare('UPDATE orders SET updated_at = ? WHERE id = ?')->execute([$now, $id]);
        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        json_error('Could not update order: ' . $e->getMessage(), 500);
    }

    // Addition set: net-new dishes, or an existing dish whose quantity went up.
    // Removed/reduced items don't get a printed notice — out of scope here.
    $added = [];
    foreach ($items as $it) {
        $name = $it['name'];
        $newQty = (int) ($it['qty'] ?? 1);
        $addedQty = $newQty - ($oldQtyByName[$name] ?? 0);
        if ($addedQty > 0) {
            $added[] = [
                'name' => $name, 'price' => $it['price'], 'qty' => $addedQty,
                'special' => !empty($it['special']), 'printStation' => print_station_for($name),
            ];
        }
    }

    if ($added) {
        $rowStmt = db()->prepare('SELECT * FROM orders WHERE id = ?');
        $rowStmt->execute([$id]);
        $orderForTicket = attach_items([$rowStmt->fetch()])[0];
        create_print_jobs($orderForTicket, $added, 'UPDATE');
    }
}

// Scalar fields — status/notes/assignedWaiter — same shape as before.
// incoming (camelCase, matches the frontend order shape) -> actual column name
$fieldMap = ['status' => 'status', 'notes' => 'notes', 'assignedWaiter' => 'assigned_waiter'];
$sets = [];
$values = [];
foreach ($fieldMap as $incoming => $column) {
    if (array_key_exists($incoming, $patch)) {
        $sets[] = "$column = ?";
        $values[] = $patch[$incoming];
    }
}

if ($sets) {
    $sets[] = 'updated_at = ?';
    $values[] = $now;
    $values[] = $id;
    $stmt = db()->prepare('UPDATE orders SET ' . implode(', ', $sets) . ' WHERE id = ?');
    $stmt->execute($values);
} elseif (!array_key_exists('items', $patch)) {
    json_error('Nothing to update');
}

$rowStmt = db()->prepare('SELECT * FROM orders WHERE id = ?');
$rowStmt->execute([$id]);
$row = $rowStmt->fetch();
$order = attach_items([$row])[0];

json_out($order);
