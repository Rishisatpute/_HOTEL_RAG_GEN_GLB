<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/orders_repo.php';
require_once __DIR__ . '/billing.php';
require_once __DIR__ . '/menu_lookup.php';

// Atomic invoice-number counter — MySQL's LAST_INSERT_ID(expr) trick makes
// this safe even if two requests hit it at the exact same moment (the
// equivalent of the MongoDB $inc counter the Node backend used).
function next_invoice_number(): string {
    $pdo = db();
    $pdo->exec('UPDATE invoice_seq SET seq = LAST_INSERT_ID(seq + 1) WHERE id = 1');
    $seq = (int) $pdo->query('SELECT LAST_INSERT_ID()')->fetchColumn();
    return 'INV-ANG-DHB-' . str_pad((string) $seq, 4, '0', STR_PAD_LEFT);
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

// Snapshots a just-paid bill into invoice_log + invoice_items, so the
// itemized receipt survives independent of the orders/order_items rows.
// Idempotent (ON DUPLICATE KEY / DELETE-then-insert) — safe if a retry
// hits this twice for the same invoice.
function log_paid_invoice(array $paidOrders): void {
    if (!$paidOrders) return;
    $invoiceNo = $paidOrders[0]['invoiceNo'];
    if (!$invoiceNo) return; // shouldn't happen — generate_invoice_for_table() always runs first

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('INSERT INTO invoice_log (invoice_no, table_no, amount, payment_method, paid_at)
                                VALUES (?, ?, ?, ?, ?)
                                ON DUPLICATE KEY UPDATE table_no = VALUES(table_no), amount = VALUES(amount),
                                    payment_method = VALUES(payment_method), paid_at = VALUES(paid_at)');
        $stmt->execute([
            $invoiceNo, $paidOrders[0]['table'], $paidOrders[0]['billTotal'],
            $paidOrders[0]['paymentMethod'], $paidOrders[0]['paidAt']
        ]);

        // Re-running this (e.g. a retried request) shouldn't duplicate items —
        // clear out anything already logged for this invoice_no first.
        $pdo->prepare('DELETE FROM invoice_items WHERE invoice_no = ?')->execute([$invoiceNo]);

        $itemStmt = $pdo->prepare('INSERT INTO invoice_items (invoice_no, name, category, price, qty)
                                    VALUES (?, ?, ?, ?, ?)');
        foreach ($paidOrders as $order) {
            foreach ($order['items'] as $item) {
                $itemStmt->execute([$invoiceNo, $item['name'], category_for($item['name']), $item['price'], $item['qty']]);
            }
        }
        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}
