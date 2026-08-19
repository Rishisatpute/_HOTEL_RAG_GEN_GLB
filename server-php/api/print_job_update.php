<?php
// PATCH /api/print_job_update.php?id=42   { success: true }  or  { success: false, error: "..." }
// The Print Agent calls this after every attempt.
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/print_jobs_repo.php';

api_bootstrap();
if ($_SERVER['REQUEST_METHOD'] !== 'PATCH') json_error('Method not allowed', 405);

$id = (int) ($_GET['id'] ?? 0);
if (!$id) json_error('id is required');

$data = body();
$success = !empty($data['success']);
$now = (int) (microtime(true) * 1000);

if ($success) {
    $stmt = db()->prepare("UPDATE print_jobs SET status = 'printed', printed_at = ?, last_error = '', attempts = attempts + 1 WHERE id = ?");
    $stmt->execute([$now, $id]);
} else {
    $stmt = db()->prepare("UPDATE print_jobs SET status = 'failed', last_error = ?, attempts = attempts + 1 WHERE id = ?");
    $stmt->execute([$data['error'] ?? 'Unknown printer error', $id]);
}

$job = find_print_job($id);
if (!$job) json_error('Print job not found', 404);
json_out($job);
