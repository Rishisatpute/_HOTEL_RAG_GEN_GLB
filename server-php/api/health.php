<?php
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/db.php';

api_bootstrap();

try {
    db()->query('SELECT 1');
    json_out(['ok' => true, 'message' => 'Angaar Dhaba API is running']);
} catch (Exception $e) {
    json_out(['ok' => false, 'message' => 'Database connection failed: ' . $e->getMessage()], 500);
}
