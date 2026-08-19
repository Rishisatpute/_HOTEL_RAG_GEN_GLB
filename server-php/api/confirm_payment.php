<?php
// POST /api/confirm_payment.php?table=7
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/billing_flow.php';

api_bootstrap();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$table = $_GET['table'] ?? '';
if (!$table) json_error('table is required');

// Ensures a bill that skipped straight to "Confirm Payment" still gets a
// locked-in invoice number and GST split first.
$generated = generate_invoice_for_table($table);
if (!$generated) json_out([]);

$method = $generated[0]['paymentMethodRequested'];
$now = (int) (microtime(true) * 1000);

$stmt = db()->prepare("UPDATE orders SET status = 'paid', payment_method = ?, paid_at = ?, updated_at = ?
                        WHERE table_no = ? AND status = 'bill_requested'");
$stmt->execute([$method, $now, $now, $table]);

$stmt2 = db()->prepare('SELECT * FROM orders WHERE table_no = ? AND paid_at = ?');
$stmt2->execute([$table, $now]);
$paid = attach_items($stmt2->fetchAll());

log_paid_invoice($paid);

// Once safely snapshotted into invoice_log/invoice_items, the detailed order rows
// serve no further purpose — orders only needs to hold currently-active business,
// not a permanently growing history. Scoped to exactly these order ids (not a
// broad "delete everything paid" sweep). order_items cascades via its FK.
$ids = array_column($paid, 'id');
if ($ids) {
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    db()->prepare("DELETE FROM orders WHERE id IN ($placeholders)")->execute($ids);
}

json_out($paid);
