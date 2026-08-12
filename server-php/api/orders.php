<?php
// GET  /api/orders.php                     -> all orders
// GET  /api/orders.php?table=7             -> orders for one table
// GET  /api/orders.php?table=7&active=1    -> orders for one table, excluding paid
// POST /api/orders.php  { table, items, notes, placedBy, waiterName } -> create
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/orders_repo.php';
require_once __DIR__ . '/../includes/menu_lookup.php';
require_once __DIR__ . '/../includes/tickets.php';
require_once __DIR__ . '/../includes/ids.php';

api_bootstrap();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $table = $_GET['table'] ?? null;
    if ($table === null) {
        json_out(find_all_orders());
    } elseif (isset($_GET['active'])) {
        json_out(find_orders_active_by_table($table));
    } else {
        json_out(find_orders_by_table($table));
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = body();
    $items = $data['items'] ?? [];
    if (!$items) json_error('items is required');

    $table = $data['table'] ?: 'Takeaway';
    $placedBy = ($data['placedBy'] ?? '') === 'waiter' ? 'waiter' : 'customer';
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

    create_station_print_jobs($order);

    json_out($order, 201);
}

json_error('Method not allowed', 405);

// Splits the order's items by print station and inserts one PrintJob per
// non-empty group — a food-only order never creates an empty BAR ticket.
function create_station_print_jobs(array $order): void {
    require_once __DIR__ . '/../includes/tickets.php';
    $byStation = ['KITCHEN' => [], 'BAR' => []];
    foreach ($order['items'] as $it) {
        $byStation[$it['printStation'] ?? 'KITCHEN'][] = $it;
    }

    $orderForTicket = [
        'id' => $order['id'], 'table_no' => $order['table'],
        'created_at' => $order['createdAt'], 'notes' => $order['notes'],
    ];

    $now = (int) (microtime(true) * 1000);
    $stmt = db()->prepare('INSERT INTO print_jobs (order_id, table_no, station, content, status, created_at)
                            VALUES (?, ?, ?, ?, "pending", ?)');

    if ($byStation['KITCHEN']) {
        $content = format_kitchen_ticket($orderForTicket, $byStation['KITCHEN']);
        $stmt->execute([$order['id'], $order['table'], 'KITCHEN', $content, $now]);
    }
    if ($byStation['BAR']) {
        $content = format_bar_ticket($orderForTicket, $byStation['BAR']);
        $stmt->execute([$order['id'], $order['table'], 'BAR', $content, $now]);
    }
}
