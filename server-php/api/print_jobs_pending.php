<?php
// GET /api/print_jobs_pending.php
// The Print Agent polls this every few seconds (no WebSockets available on
// shared hosting, so polling replaces the old Socket.io push entirely).
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/print_jobs_repo.php';

api_bootstrap();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

json_out(find_pending_print_jobs());
