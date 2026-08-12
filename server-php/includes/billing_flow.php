<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/orders_repo.php';
require_once __DIR__ . '/billing.php';

// Atomic invoice-number counter — MySQL's LAST_INSERT_ID(expr) trick makes
// this safe even if two requests hit it at the exact same moment (the
// equivalent of the MongoDB $inc counter the Node backend used).
function next_invoice_number(): string {
    $pdo = db();
    $pdo->exec('UPDATE invoice_seq SET seq = LAST_INSERT_ID(seq + 1) WHERE id = 1');
    $seq = (int) $pdo->query('SELECT LAST_INSERT_ID()')->fetchColumn();
    return 'INV-EKP-' . str_pad((string) $seq, 6, '0', STR_PAD_LEFT);
}

// Locks in the invoice number + GST breakdown for a table's pending bill,
// without marking it paid. Idempotent — calling it again just returns the
// already-generated invoice instead of minting a new number, so Counter
// staff can click it freely.
function generate_invoice_for_table(string $table): array {
    $pending = find_orders_by_status($table, 'bill_requested');
    if (!$pending) return [];
    if ($pending[0]['invoiceNo']) return $pending;

    $subtotal = 0.0;
    foreach ($pending as $o) $subtotal += order_total($o['items']);
    $bill = bill_breakdown($subtotal);
    $invoiceNo = next_invoice_number();
    $now = (int) (microtime(true) * 1000);

    $stmt = db()->prepare("UPDATE orders SET gst_rate=?, half_rate=?, gst_amount=?, cgst_amount=?, sgst_amount=?,
                            bill_subtotal=?, bill_total=?, invoice_no=?, invoice_generated_at=?, updated_at=?
                            WHERE table_no = ? AND status = 'bill_requested'");
    $stmt->execute([
        $bill['rate'], $bill['halfRate'], $bill['gst'], $bill['cgst'], $bill['sgst'],
        $bill['subtotal'], $bill['total'], $invoiceNo, $now, $now, $table
    ]);

    return find_orders_by_invoice($table, $invoiceNo);
}
