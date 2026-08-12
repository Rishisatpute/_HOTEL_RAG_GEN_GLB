<?php
// POST /api/print_bill.php?table=7
// Prints the full itemized bill on the counter's billing printer. Prices
// only ever appear here — never on a KITCHEN/BAR ticket. Generates the
// invoice first if it hasn't been yet, so the printed amount and the one
// shown on screen always match.
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/billing_flow.php';
require_once __DIR__ . '/../includes/menu_lookup.php';
require_once __DIR__ . '/../includes/tickets.php';
require_once __DIR__ . '/../includes/print_jobs_repo.php';

api_bootstrap();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$table = $_GET['table'] ?? '';
if (!$table) json_error('table is required');

$orders = generate_invoice_for_table($table);
if (!$orders) json_error('No bill pending for this table', 400);

$ordersForTicket = array_map(fn($o) => [
    'id' => $o['id'], 'table_no' => $o['table'], 'items' => $o['items'],
    'invoice_no' => $o['invoiceNo'], 'bill_subtotal' => $o['billSubtotal'],
    'half_rate' => $o['halfRate'], 'cgst_amount' => $o['cgstAmount'],
    'sgst_amount' => $o['sgstAmount'], 'bill_total' => $o['billTotal'],
], $orders);

$content = format_bill_ticket(restaurant_info(), $ordersForTicket);
$now = (int) (microtime(true) * 1000);

$stmt = db()->prepare('INSERT INTO print_jobs (order_id, table_no, station, content, status, created_at)
                        VALUES (?, ?, "BILLING", ?, "pending", ?)');
$stmt->execute([$orders[0]['id'], $table, $content, $now]);

$id = (int) db()->lastInsertId();
json_out(find_print_job($id), 201);
