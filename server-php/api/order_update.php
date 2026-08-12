<?php
// PATCH /api/order_update.php?id=EP1A2B3C4D5   { status: "preparing" }
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/orders_repo.php';

api_bootstrap();

if ($_SERVER['REQUEST_METHOD'] !== 'PATCH') json_error('Method not allowed', 405);

$id = $_GET['id'] ?? '';
if (!$id) json_error('id is required');

$patch = body();
$allowed = ['status', 'notes'];
$sets = [];
$values = [];
foreach ($allowed as $field) {
    if (array_key_exists($field, $patch)) {
        $sets[] = "$field = ?";
        $values[] = $patch[$field];
    }
}
if (!$sets) json_error('Nothing to update');

$sets[] = 'updated_at = ?';
$values[] = (int) (microtime(true) * 1000);
$values[] = $id;

$stmt = db()->prepare('UPDATE orders SET ' . implode(', ', $sets) . ' WHERE id = ?');
$stmt->execute($values);

if ($stmt->rowCount() === 0) {
    // Could be "already had this value" rather than "not found" — check separately.
    $check = db()->prepare('SELECT id FROM orders WHERE id = ?');
    $check->execute([$id]);
    if (!$check->fetch()) json_error('Order not found', 404);
}

$rowStmt = db()->prepare('SELECT * FROM orders WHERE id = ?');
$rowStmt->execute([$id]);
$row = $rowStmt->fetch();
$order = attach_items([$row])[0];

json_out($order);
