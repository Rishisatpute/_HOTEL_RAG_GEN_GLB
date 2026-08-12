<?php
// Same friendly id format the app has always used (first client-side, then
// the Node backend) — so ids look identical no matter which backend minted
// them.
function gen_id(): string {
    $time = base_convert((string) round(microtime(true) * 1000), 10, 36);
    $rand = strtoupper(substr(bin2hex(random_bytes(3)), 0, 3));
    return 'EP' . strtoupper($time) . $rand;
}
