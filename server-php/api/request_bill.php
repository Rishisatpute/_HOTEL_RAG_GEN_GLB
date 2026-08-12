<?php
// POST /api/request_bill.php?table=7   { method: "cash" }
// Every DELIVERED order at the table moves to bill_requested, grouped
// under one billId.
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/orders_repo.php';
require_once __DIR__ . '/../includes/ids.php';

api_bootstrap();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$table = $_GET['table'] ?? '';
if (!$table) json_error('table is required');

$method = body()['method'] ?? '';
$now = (int) (microtime(true) * 1000);
$billId = gen_id();

$stmt = db()->prepare("UPDATE orders SET status = 'bill_requested', payment_method_requested = ?, bill_requested_at = ?, bill_id = ?, updated_at = ?
                        WHERE table_no = ? AND status = 'delivered'");
$stmt->execute([$method, $now, $billId, $now, $table]);

if ($stmt->rowCount() === 0) json_out([]);

json_out(find_orders_by_bill_id($table, $billId));
