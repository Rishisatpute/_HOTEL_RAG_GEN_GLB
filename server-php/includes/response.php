<?php
require_once __DIR__ . '/../config/config.php';

// Call this first, before any output, in every api/*.php file.
function api_bootstrap(): void {
    header('Content-Type: application/json; charset=utf-8');

    $allowed = array_filter(array_map('trim', explode(',', config('ALLOWED_ORIGINS', ''))));
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (in_array($origin, $allowed, true)) {
        header("Access-Control-Allow-Origin: $origin");
        header('Vary: Origin');
    }
    header('Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function json_out($data, int $status = 200): never {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

function json_error(string $message, int $status = 400): never {
    json_out(['error' => $message], $status);
}

// Reads and JSON-decodes the request body (POST/PATCH), consistently.
function body(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}
