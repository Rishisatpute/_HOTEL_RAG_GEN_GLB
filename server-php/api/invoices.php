<?php
// GET /api/invoices.php?from=<ms>&to=<ms>  -> paid invoices in that time range, newest first
// Reads invoice_log + invoice_items — the durable record of what got billed —
// never orders/order_items, which only hold currently-active business.
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/db.php';

api_bootstrap();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

$from = isset($_GET['from']) ? (int) $_GET['from'] : 0;
$to = isset($_GET['to']) ? (int) $_GET['to'] : PHP_INT_MAX;

$stmt = db()->prepare('SELECT * FROM invoice_log WHERE paid_at BETWEEN ? AND ? ORDER BY paid_at DESC');
$stmt->execute([$from, $to]);
$invoices = $stmt->fetchAll();
if (!$invoices) json_out([]);

$nos = array_column($invoices, 'invoice_no');
$placeholders = implode(',', array_fill(0, count($nos), '?'));
$itemStmt = db()->prepare("SELECT * FROM invoice_items WHERE invoice_no IN ($placeholders) ORDER BY id");
$itemStmt->execute($nos);
$itemsByInvoice = [];
foreach ($itemStmt->fetchAll() as $it) {
    $itemsByInvoice[$it['invoice_no']][] = [
        'name' => $it['name'],
        'category' => $it['category'],
        'price' => (float) $it['price'],
        'qty' => (int) $it['qty'],
    ];
}

json_out(array_map(fn($inv) => [
    'invoiceNo' => $inv['invoice_no'],
    'table' => $inv['table_no'],
    'amount' => (float) $inv['amount'],
    'paymentMethod' => $inv['payment_method'],
    'paidAt' => (int) $inv['paid_at'],
    'items' => $itemsByInvoice[$inv['invoice_no']] ?? [],
], $invoices));
