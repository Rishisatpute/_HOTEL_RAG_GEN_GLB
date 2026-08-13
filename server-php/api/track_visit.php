<?php
// GET  /api/track_visit.php          -> all recorded page views (for the Sales Dashboard)
// POST /api/track_visit.php  { page } -> records one real page load
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/db.php';

api_bootstrap();

// Fixed whitelist — this only ever tracks the customer-facing pages, never
// arbitrary strings, so a stray/misbehaving client can't pollute the table.
const TRACKED_PAGES = ['home', 'menu'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $rows = db()->query('SELECT page, created_at FROM page_views ORDER BY created_at ASC')->fetchAll();
    json_out(array_map(fn($r) => ['page' => $r['page'], 'createdAt' => (int) $r['created_at']], $rows));
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = body();
    $page = $data['page'] ?? '';
    if (!in_array($page, TRACKED_PAGES, true)) json_error('Unknown page');

    $stmt = db()->prepare('INSERT INTO page_views (page, created_at) VALUES (?, ?)');
    $stmt->execute([$page, (int) (microtime(true) * 1000)]);
    json_out(['ok' => true], 201);
}

json_error('Method not allowed', 405);
