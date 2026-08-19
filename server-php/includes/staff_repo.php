<?php
require_once __DIR__ . '/db.php';

// Looks up a personal waiter/counter PIN. Returns null for no match or a
// deactivated row (active=0) — staff_login.php falls back to the shared
// STAFF_PIN in either case, same as if the row never existed.
function find_staff_by_pin(string $pin): ?array {
    $stmt = db()->prepare('SELECT pin, name, role FROM staff_logins WHERE pin = ? AND active = 1');
    $stmt->execute([$pin]);
    $row = $stmt->fetch();
    return $row ?: null;
}
