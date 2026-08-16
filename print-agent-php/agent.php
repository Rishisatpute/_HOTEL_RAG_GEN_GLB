<?php
// Angaar Dhaba Print Agent (PHP) — runs on a computer inside the
// restaurant, on the same network as the Kitchen/Bar/Billing printers.
//
// No WebSockets available (shared hosting can't run a persistent socket
// server), so this POLLS the backend every few seconds for pending print
// jobs instead of receiving an instant push. A few seconds of lag between
// an order landing and it reaching the kitchen printer is the tradeoff for
// not needing a dedicated server just to run this.
//
// Run with: php agent.php   (needs to keep running — see README.md for how
// to keep it alive in the background on Windows/restaurant PC)

function load_env(string $path): array {
    $env = [];
    if (!file_exists($path)) return $env;
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) continue;
        [$k, $v] = explode('=', $line, 2);
        $env[trim($k)] = trim($v);
    }
    return $env;
}

$env = load_env(__DIR__ . '/.env');
$BACKEND_URL = rtrim($env['BACKEND_URL'] ?? '', '/');
$POLL_SECONDS = (int) ($env['POLL_SECONDS'] ?? 4);
$PRINTER_PORT = (int) ($env['PRINTER_PORT'] ?? 9100);
$DRY_RUN = ($env['DRY_RUN'] ?? 'false') === 'true';
$PRINTERS = [
    'KITCHEN' => $env['KITCHEN_PRINTER_IP'] ?? '',
    'BAR' => $env['BAR_PRINTER_IP'] ?? '',
    'BILLING' => $env['BILLING_PRINTER_IP'] ?? '',
];

if (!$BACKEND_URL) {
    fwrite(STDERR, "[Agent] BACKEND_URL is not set. Copy .env.example to .env and fill it in.\n");
    exit(1);
}

// Uses only PHP's built-in http:// stream wrapper (no curl extension
// required) — this agent runs on whatever PC a restaurant happens to set
// up, so it shouldn't depend on anything beyond a stock PHP install.
function http_json(string $method, string $url, ?array $body = null): array {
    $options = ['http' => [
        'method' => $method,
        'header' => "Content-Type: application/json\r\n",
        'timeout' => 15,
        'ignore_errors' => true,
    ]];
    if ($body !== null) {
        $options['http']['content'] = json_encode($body);
    }
    $result = @file_get_contents($url, false, stream_context_create($options));
    if ($result === false) {
        $err = error_get_last();
        throw new Exception($err['message'] ?? 'request failed');
    }
    $data = json_decode($result, true);
    return is_array($data) ? $data : [];
}

// Sends one ticket to one physical printer over the network as raw ESC/POS
// bytes. ESC @ resets the printer, then the ticket text line by line, a
// short feed, then a full paper cut.
function print_ticket(string $station, string $content, array $printers, int $port, bool $dryRun): array {
    $ip = $printers[$station] ?? '';

    if ($dryRun || !$ip) {
        echo "\n[" . ($dryRun ? 'DRY RUN' : 'NO IP CONFIGURED for ' . $station) . "] Would print to $station:\n$content\n";
        return ['success' => true];
    }

    $fp = @fsockopen($ip, $port, $errno, $errstr, 5);
    if (!$fp) {
        return ['success' => false, 'error' => "$station printer ($ip) not reachable: $errstr"];
    }

    stream_set_timeout($fp, 5);
    $bytes = "\x1B\x40"; // ESC @ — initialize
    $bytes .= "\x1B\x37\x0F\xFF\x02"; // ESC 7 — max heating dots/time, min interval = highest print density
    $bytes .= "\x1B\x45\x01"; // ESC E 1 — bold (emphasized) on, for extra contrast on thin thermal paper
    $bytes .= str_replace("\n", "\r\n", $content);
    $bytes .= "\x1B\x45\x00"; // ESC E 0 — bold off
    $bytes .= "\n\n\n";
    $bytes .= "\x1D\x56\x00"; // GS V 0 — full cut
    fwrite($fp, $bytes);
    fclose($fp);

    echo "[Agent] Printed to $station ($ip)\n";
    return ['success' => true];
}

function handle_job(array $job, string $backend, array $printers, int $port, bool $dryRun): void {
    echo "[Agent] New {$job['station']} job for order {$job['orderId']} (table {$job['table']})\n";
    $result = print_ticket($job['station'], $job['content'], $printers, $port, $dryRun);

    try {
        http_json('PATCH', "$backend/api/print_job_update.php?id={$job['id']}", $result);
    } catch (Exception $e) {
        // The print already happened (or failed) either way — losing this
        // status update just means the dashboard won't show it, not a lost order.
        fwrite(STDERR, "[Agent] Could not report job status back to server: {$e->getMessage()}\n");
    }
}

echo "[Agent] Starting. Printers configured: " . json_encode($PRINTERS) . "\n";
if ($DRY_RUN) echo "[Agent] DRY_RUN is on — nothing will be sent to a real printer.\n";
echo "[Agent] Polling $BACKEND_URL every {$POLL_SECONDS}s for print jobs...\n";

while (true) {
    try {
        $jobs = http_json('GET', "$BACKEND_URL/api/print_jobs_pending.php");
        foreach ($jobs as $job) {
            handle_job($job, $BACKEND_URL, $PRINTERS, $PRINTER_PORT, $DRY_RUN);
        }
    } catch (Exception $e) {
        fwrite(STDERR, "[Agent] Could not reach backend: {$e->getMessage()}\n");
    }
    sleep($POLL_SECONDS);
}
