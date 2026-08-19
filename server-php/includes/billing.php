<?php
// Same GST math as the Node backend had (utils/billing.js) — fixed 5% rate,
// split evenly into CGST + SGST for an intra-state sale, rounded to paise.
const GST_RATE = 5;

function price_number($p): float {
    if (is_numeric($p)) return (float) $p;
    preg_match('/[\d.]+/', (string) $p, $m);
    return isset($m[0]) ? (float) $m[0] : 0.0;
}

function item_total(array $item): float {
    return price_number($item['price']) * ($item['qty'] ?? 1);
}

function order_total(array $items): float {
    $sum = 0.0;
    foreach ($items as $it) $sum += item_total($it);
    return $sum;
}

// subtotal -> ['subtotal','rate','halfRate','gst','cgst','sgst','total']
function bill_breakdown(float $subtotal, ?float $rate = null): array {
    $r = $rate ?? GST_RATE;
    $gstAmount = round($subtotal * $r / 100, 2);
    $halfRate = round($r / 2, 2);
    $half = round($gstAmount / 2, 2);
    return [
        'subtotal' => $subtotal,
        'rate' => $r,
        'halfRate' => $halfRate,
        'gst' => $gstAmount,
        'cgst' => $half,
        'sgst' => $half,
        'total' => round($subtotal + $gstAmount, 2),
    ];
}
