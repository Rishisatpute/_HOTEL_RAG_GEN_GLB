<?php
require_once __DIR__ . '/../config/config.php';

function db(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $host = config('DB_HOST', 'localhost');
    $name = config('DB_NAME');
    $user = config('DB_USER');
    $pass = config('DB_PASSWORD');

    if (!$name || !$user) {
        http_response_code(500);
        die(json_encode(['error' => 'Database is not configured. Copy config/.env.example to config/.env and fill it in.']));
    }

    $dsn = "mysql:host=$host;dbname=$name;charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}
