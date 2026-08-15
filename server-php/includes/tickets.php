<?php
require_once __DIR__ . '/db.php';

function ticket_line(string $ch = '-', int $len = 32): string {
    return str_repeat($ch, $len);
}

// Plain substr/str_pad on purpose, not the mb_ variants — dish names are
// always plain ASCII, and this way ticket printing doesn't depend on the
// mbstring extension being enabled (not guaranteed on every shared host).
function ticket_pad(string $str, int $len): string {
    $str = substr($str, 0, $len);
    return str_pad($str, $len);
}

function ticket_fmt_time(int $ts): string {
    $dt = new DateTime('@' . intdiv($ts, 1000));
    $dt->setTimezone(new DateTimeZone('Asia/Kolkata'));
    return $dt->format('d M, h:i a');
}

// Kitchen/Bar tickets (KOT/BOT) — name + qty + notes only. No prices, ever.
// $items here are the order's items already filtered to one station.
// $suffix marks a reprint that's an addition to an already-placed order
// (e.g. 'UPDATE') rather than the original ticket — the table number sits
// right in the heading either way so it can't be missed at the printer.
function format_station_ticket(string $stationLabel, array $order, array $items, string $suffix = ''): string {
    $rows = [
        ticket_line('='),
        "      $stationLabel ORDER" . ($suffix !== '' ? " - $suffix" : ''),
        "      TABLE {$order['table_no']}",
        ticket_line('='),
        "Order: #{$order['id']}",
        "Table: {$order['table_no']}",
        'Time:  ' . ticket_fmt_time($order['created_at']),
        ticket_line('-'),
    ];
    foreach ($items as $it) {
        $rows[] = "{$it['qty']} x {$it['name']}";
    }
    if (!empty($order['notes'])) {
        $rows[] = ticket_line('-');
        $rows[] = 'Notes:';
        $rows[] = $order['notes'];
    }
    $rows[] = ticket_line('=');
    $rows[] = '';
    return implode("\n", $rows);
}

function format_kitchen_ticket(array $order, array $items, string $suffix = ''): string {
    return format_station_ticket('KITCHEN', $order, $items, $suffix);
}

function format_bar_ticket(array $order, array $items, string $suffix = ''): string {
    return format_station_ticket('BAR', $order, $items, $suffix);
}

// Splits $items by print station and inserts one pending print_jobs row per
// non-empty station (a food-only order never creates an empty BAR ticket).
// $suffix distinguishes an addition-to-an-existing-order reprint ('UPDATE')
// from the original ticket. Shared by orders.php (new order) and
// order_update.php (items added to an existing order).
function create_print_jobs(array $order, array $items, string $suffix = ''): void {
    $byStation = ['KITCHEN' => [], 'BAR' => []];
    foreach ($items as $it) {
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
        $content = format_kitchen_ticket($orderForTicket, $byStation['KITCHEN'], $suffix);
        $stmt->execute([$order['id'], $order['table'], 'KITCHEN', $content, $now]);
    }
    if ($byStation['BAR']) {
        $content = format_bar_ticket($orderForTicket, $byStation['BAR'], $suffix);
        $stmt->execute([$order['id'], $order['table'], 'BAR', $content, $now]);
    }
}

// Billing ticket — full itemized bill with GST breakdown, for the counter's
// Epson printer only. This is the one place prices are allowed to print.
// Address is deliberately left off — it's shown on screen (the invoice modal)
// but not worth the extra line on a receipt handed over in person.
function format_bill_ticket(array $restaurant, array $orders): string {
    $first = $orders[0];
    $allItems = [];
    foreach ($orders as $o) foreach ($o['items'] as $it) $allItems[] = $it;

    $rows = [
        ticket_line('='),
        strtoupper($restaurant['name'] ?? 'RESTAURANT'),
        ticket_line('-'),
        'Invoice: ' . ($first['invoice_no'] ?? $first['id']),
        "Table:   {$first['table_no']}",
        'Time:    ' . ticket_fmt_time((int) (microtime(true) * 1000)),
        ticket_line('-'),
        ticket_pad('Item', 18) . ticket_pad('Qty', 4) . ticket_pad('Amt', 10),
        ticket_line('-'),
    ];
    foreach ($allItems as $it) {
        $amt = 'Rs.' . ($it['price'] * $it['qty']);
        $rows[] = ticket_pad($it['name'], 18) . ticket_pad((string) $it['qty'], 4) . ticket_pad($amt, 10);
    }
    $rows[] = ticket_line('-');
    $rows[] = ticket_pad('Subtotal', 22) . 'Rs.' . ($first['bill_subtotal'] ?? '');
    $rows[] = ticket_pad('CGST ' . ($first['half_rate'] ?? '') . '%', 22) . 'Rs.' . ($first['cgst_amount'] ?? '');
    $rows[] = ticket_pad('SGST ' . ($first['half_rate'] ?? '') . '%', 22) . 'Rs.' . ($first['sgst_amount'] ?? '');
    $rows[] = ticket_line('-');
    $rows[] = ticket_pad('TOTAL', 22) . 'Rs.' . ($first['bill_total'] ?? '');
    $rows[] = ticket_line('=');
    $rows[] = 'Thank you for dining with us';
    $rows[] = '';
    return implode("\n", $rows);
}
