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
json_out(attach_items($stmt2->fetchAll()));
