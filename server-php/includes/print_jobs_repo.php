<?php
require_once __DIR__ . '/db.php';

function print_job_row_to_json(array $row): array {
    return [
        'id' => (int) $row['id'],
        'orderId' => $row['order_id'],
        'table' => $row['table_no'],
        'station' => $row['station'],
        'content' => $row['content'],
        'status' => $row['status'],
        'attempts' => (int) $row['attempts'],
        'lastError' => $row['last_error'],
        'createdAt' => (int) $row['created_at'],
        'printedAt' => $row['printed_at'] !== null ? (int) $row['printed_at'] : null,
    ];
}

function find_print_job(int $id): ?array {
    $stmt = db()->prepare('SELECT * FROM print_jobs WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ? print_job_row_to_json($row) : null;
}

function find_pending_print_jobs(): array {
    $rows = db()->query("SELECT * FROM print_jobs WHERE status = 'pending' ORDER BY created_at ASC")->fetchAll();
    return array_map('print_job_row_to_json', $rows);
}
