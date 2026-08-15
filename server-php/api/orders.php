<?php
// GET  /api/orders.php                          -> all orders
// GET  /api/orders.php?table=7                  -> orders for one table
// GET  /api/orders.php?table=7&active=1         -> orders for one table, excluding paid
// GET  /api/orders.php?status=ready,delivered   -> orders in any of these statuses, any table
// POST /api/orders.php  { table, items, notes, placedBy, waiterName } -> create
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/orders_repo.php';
require_once __DIR__ . '/../includes/menu_lookup.php';
require_once __DIR__ . '/../includes/tickets.php';
require_once __DIR__ . '/../includes/ids.php';

api_bootstrap();

// Every status the `orders.status` ENUM actually allows — a whitelist so a
// bad ?status= value fails fast with a clear error instead of reaching SQL.
const VALID_STATUSES = ['new', 'preparing', 'ready', 'delivered', 'bill_requested', 'paid'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $table = $_GET['table'] ?? null;
    if ($table !== null) {
        json_out(isset($_GET['active']) ? find_orders_active_by_table($table) : find_orders_by_table($table));
    } elseif (isset($_GET['status'])) {
        $statuses = array_filter(array_map('trim', explode(',', $_GET['status'])));
        $invalid = array_diff($statuses, VALID_STATUSES);
        if ($invalid) json_error('Invalid status: ' . implode(', ', $invalid));
        json_out(find_orders_by_statuses($statuses));
    } else {
        json_out(find_all_orders());
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = body();
    $items = $data['items'] ?? [];
    if (!$items) json_error('items is required');

    $table = $data['table'] ?: 'Takeaway';
    $placedBy = ($data['placedBy'] ?? '') === 'waiter' ? 'waiter' : 'customer';

    // Staff (waiter) and Takeaway are trusted/exempt. Everyone else needs either a
    // valid per-table QR token (proves they scanned the physical table — multiple
    // order rounds are then fine, no occupancy check) or, with no token at all
    // (the manual dropdown path), the table must currently be free to claim.
    if ($placedBy !== 'waiter' && $table !== 'Takeaway') {
        $token = $data['token'] ?? null;
        if ($token) {
            $stmt = db()->prepare('SELECT 1 FROM tables WHERE table_no = ? AND token = ?');
            $stmt->execute([$table, $token]);
            if (!$stmt->fetchColumn()) json_error('Invalid table link — please rescan the QR code on your table', 403);
        } else {
            $stmt = db()->prepare('SELECT 1 FROM tables WHERE table_no = ?');
            $stmt->execute([$table]);
            if (!$stmt->fetchColumn()) json_error('Unknown table', 400);
            $stmt = db()->prepare('SELECT 1 FROM orders WHERE table_no = ? LIMIT 1');
            $stmt->execute([$table]);
            if ($stmt->fetchColumn()) json_error('That table is currently occupied — please pick another', 409);
        }
    }

    $now = (int) (microtime(true) * 1000);
    $id = gen_id();

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('INSERT INTO orders (id, table_no, status, created_at, updated_at, notes, placed_by, waiter_name)
                                VALUES (?, ?, "new", ?, ?, ?, ?, ?)');
        $stmt->execute([$id, $table, $now, $now, $data['notes'] ?? '', $placedBy, $data['waiterName'] ?? '']);

        $itemStmt = $pdo->prepare('INSERT INTO order_items (order_id, name, price, qty, special, print_station)
                                    VALUES (?, ?, ?, ?, ?, ?)');
        foreach ($items as $it) {
            $station = print_station_for($it['name']);
            $itemStmt->execute([$id, $it['name'], $it['price'], $it['qty'] ?? 1, !empty($it['special']) ? 1 : 0, $station]);
        }
        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        json_error('Could not create order: ' . $e->getMessage(), 500);
    }

    $order = find_orders_by_table($table);
    $order = array_values(array_filter($order, fn($o) => $o['id'] === $id))[0];

    create_print_jobs($order, $order['items']);

    json_out($order, 201);
}

json_error('Method not allowed', 405);
