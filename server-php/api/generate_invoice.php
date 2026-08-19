<?php
// POST /api/generate_invoice.php?table=7
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/billing_flow.php';

api_bootstrap();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$table = $_GET['table'] ?? '';
if (!$table) json_error('table is required');

json_out(generate_invoice_for_table($table));
