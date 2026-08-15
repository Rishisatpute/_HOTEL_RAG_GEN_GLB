<?php
// POST /api/order_delete.php?id=EP1A2B3C4D5
// Waiter-facing "delete this order" (cancel a mistaken/unwanted order before
// it's paid). order_items cascades via its FK. Any print_jobs for this order
// that haven't printed yet are also removed, so the kitchen/bar never prints
// a ticket for an order that no longer exists — jobs already printed are left
// alone as history, since that ticket physically already happened.
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/db.php';

api_bootstrap();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$id = $_GET['id'] ?? '';
if (!$id) json_error('id is required');

$pdo = db();
$pdo->beginTransaction();
try {
    $pdo->prepare("DELETE FROM print_jobs WHERE order_id = ? AND status = 'pending'")->execute([$id]);
    $stmt = $pdo->prepare('DELETE FROM orders WHERE id = ?');
    $stmt->execute([$id]);
    $deleted = $stmt->rowCount();
    $pdo->commit();
} catch (Exception $e) {
    $pdo->rollBack();
    json_error('Could not delete order: ' . $e->getMessage(), 500);
}

if ($deleted === 0) json_error('Order not found', 404);
json_out(['ok' => true]);
