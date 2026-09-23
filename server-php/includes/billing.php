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

// Counter-only, applied AFTER GST — GST is charged on the full subtotal like
// normal, then the discount % comes off that GST-inclusive total. Staff pick
// one of 0/5/10/...% on the bill card before generating the invoice; see
// counter.js.
const DISCOUNT_STEP = 5;
const MAX_DISCOUNT_PCT = 100;

function clamp_discount_pct($pct): float {
    $p = (float) $pct;
    if ($p < 0) $p = 0.0;
    if ($p > MAX_DISCOUNT_PCT) $p = (float) MAX_DISCOUNT_PCT;
    // Snap to the nearest 5% step — the UI only ever offers steps of 5, this
    // just guards against a malformed/off-step value reaching here directly.
    return round($p / DISCOUNT_STEP) * DISCOUNT_STEP;
}

// subtotal -> ['subtotal','rate','halfRate','gst','cgst','sgst','discountPct','discountAmount','total']
// GST is computed on the full (pre-discount) subtotal; the discount is then
// taken off (subtotal + gst), and 'total' is what's actually payable.
function bill_breakdown(float $subtotal, ?float $rate = null, float $discountPct = 0.0): array {
    $r = $rate ?? GST_RATE;
    $discountPct = clamp_discount_pct($discountPct);
    $gstAmount = round($subtotal * $r / 100, 2);
    $halfRate = round($r / 2, 2);
    $half = round($gstAmount / 2, 2);
    $preDiscountTotal = round($subtotal + $gstAmount, 2);
    $discountAmount = round($preDiscountTotal * $discountPct / 100, 2);
    return [
        'subtotal' => $subtotal,
        'rate' => $r,
        'halfRate' => $halfRate,
        'gst' => $gstAmount,
        'cgst' => $half,
        'sgst' => $half,
        'discountPct' => $discountPct,
        'discountAmount' => $discountAmount,
        'total' => round($preDiscountTotal - $discountAmount, 2),
    ];
}
