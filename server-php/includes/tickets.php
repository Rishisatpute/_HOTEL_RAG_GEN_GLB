<?php
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
function format_station_ticket(string $stationLabel, array $order, array $items): string {
    $rows = [
        ticket_line('='),
        "      $stationLabel ORDER",
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

function format_kitchen_ticket(array $order, array $items): string {
    return format_station_ticket('KITCHEN', $order, $items);
}

function format_bar_ticket(array $order, array $items): string {
    return format_station_ticket('BAR', $order, $items);
}

// Billing ticket — full itemized bill with GST breakdown, for the counter's
// Epson printer only. This is the one place prices are allowed to print.
function format_bill_ticket(array $restaurant, array $orders): string {
    $first = $orders[0];
    $allItems = [];
    foreach ($orders as $o) foreach ($o['items'] as $it) $allItems[] = $it;

    $rows = [
        ticket_line('='),
        strtoupper($restaurant['name'] ?? 'RESTAURANT'),
        $restaurant['tagline'] ?? '',
        $restaurant['address'] ?? '',
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
