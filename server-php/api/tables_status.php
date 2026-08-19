<?php
// GET /api/tables_status.php -> [{table, occupied}]
// Customer-facing (the "Set table" dropdown) — deliberately never returns a
// token, only occupied/free. "Occupied" means the table currently has at
// least one order in `orders` — which, since paid orders are deleted at
// confirm_payment time, is exactly "this table has active, unpaid business
// right now". A table frees up the instant its bill is confirmed paid.
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/db.php';

api_bootstrap();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

$tables = db()->query('SELECT table_no FROM tables ORDER BY table_no')->fetchAll(PDO::FETCH_COLUMN);
$occupied = array_flip(db()->query('SELECT DISTINCT table_no FROM orders')->fetchAll(PDO::FETCH_COLUMN));

json_out(array_map(fn($t) => ['table' => $t, 'occupied' => isset($occupied[$t])], $tables));
