<?php
// POST /api/tables_ensure.php  { tables: ["1","2",...] }  -> [{table, token}]
// Staff-only tool (table-qr.html) — creates a token for any table in the list
// that doesn't have one yet, and returns the token for every table in the
// list either way. Idempotent: re-running with the same list never changes
// an existing token, so regenerating a QR sheet never invalidates codes
// that are already printed and stuck to a table.
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/ids.php';

api_bootstrap();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$data = body();
$wanted = array_values(array_unique(array_filter(array_map('strval', $data['tables'] ?? []))));
if (!$wanted) json_error('tables is required');

$pdo = db();
$insert = $pdo->prepare('INSERT IGNORE INTO tables (table_no, token) VALUES (?, ?)');
foreach ($wanted as $t) {
    $insert->execute([$t, gen_table_token()]);
}

$placeholders = implode(',', array_fill(0, count($wanted), '?'));
$stmt = $pdo->prepare("SELECT table_no, token FROM tables WHERE table_no IN ($placeholders)");
$stmt->execute($wanted);

json_out(array_map(fn($row) => ['table' => $row['table_no'], 'token' => $row['token']], $stmt->fetchAll()));
