<?php
// POST /api/print_job_retry.php?id=42
// Dashboard "reprint" action: resets a failed job back to pending so the
// Print Agent's next poll picks it up again.
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/print_jobs_repo.php';

api_bootstrap();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$id = (int) ($_GET['id'] ?? 0);
if (!$id) json_error('id is required');

$stmt = db()->prepare("UPDATE print_jobs SET status = 'pending', last_error = '' WHERE id = ?");
$stmt->execute([$id]);

$job = find_print_job($id);
if (!$job) json_error('Print job not found', 404);
json_out($job);
