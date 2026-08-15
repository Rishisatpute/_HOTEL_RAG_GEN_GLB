<?php
// POST /api/staff_login.php  { pin }    -> {ok:true, name, role} for a personal
//                                          waiter/counter PIN (see staff_logins),
//                                          or {ok:true} (no role) for the shared
//                                          STAFF_PIN manager/hub fallback — 401
//                                          if it matches neither
//                             { token } -> {ok:true} or 401 — the staff.html?token=
//                                          bookmark link, an alternative to typing the PIN
// All three secrets are only ever checked server-side — the frontend never has
// any of them in source, just remembers "verified" (and, for a personal PIN,
// who) once this says yes.
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/staff_repo.php';

api_bootstrap();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$data = body();

if (array_key_exists('token', $data)) {
    $token = (string) $data['token'];
    $expectedToken = (string) config('STAFF_ACCESS_TOKEN', '');
    if ($expectedToken === '' || !hash_equals($expectedToken, $token)) {
        json_error('Invalid token', 401);
    }
    json_out(['ok' => true]);
}

$pin = (string) ($data['pin'] ?? '');

$staff = $pin !== '' ? find_staff_by_pin($pin) : null;
if ($staff) {
    json_out(['ok' => true, 'name' => $staff['name'], 'role' => $staff['role']]);
}

$expected = (string) config('STAFF_PIN', '');
if ($expected === '' || !hash_equals($expected, $pin)) {
    json_error('Incorrect PIN', 401);
}

json_out(['ok' => true]);
