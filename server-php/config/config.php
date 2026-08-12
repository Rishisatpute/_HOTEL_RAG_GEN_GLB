<?php
// Loads settings from a .env file next to this one (same idea as the old
// Node backend's dotenv, since PHP has no equivalent built in). Also checks
// real environment variables first, in case your host sets them a different
// way (some cPanel "Setup Node.js/PHP App" panels let you set env vars
// directly — those would take priority automatically).

function config_load_env(string $path): void {
    if (!file_exists($path)) return;
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) continue;
        if (!str_contains($line, '=')) continue;
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        if (getenv($key) === false) {
            putenv("$key=$value");
        }
    }
}

config_load_env(__DIR__ . '/.env');

function config(string $key, $default = null) {
    $value = getenv($key);
    return $value === false ? $default : $value;
}
