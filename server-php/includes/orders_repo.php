<?php
require_once __DIR__ . '/db.php';

// Maps a snake_case DB row (+ its items) to the same camelCase shape the
// frontend has always consumed — so menu.js/waiter.js/counter.js
// don't need to change at all, only the API layer underneath them did.
function row_to_order(array $row, array $items): array {
    return [
        'id' => $row['id'],
        'table' => $row['table_no'],
        'items' => array_map(fn($it) => [
            'name' => $it['name'],
            'price' => (float) $it['price'],
            'qty' => (int) $it['qty'],
            'special' => (bool) $it['special'],
            'printStation' => $it['print_station'],
        ], $items),
        'status' => $row['status'],
        'paymentMethodRequested' => $row['payment_method_requested'],
        'paymentMethod' => $row['payment_method'],
        'billRequestedAt' => $row['bill_requested_at'] !== null ? (int) $row['bill_requested_at'] : null,
        'paidAt' => $row['paid_at'] !== null ? (int) $row['paid_at'] : null,
        'createdAt' => (int) $row['created_at'],
        'updatedAt' => (int) $row['updated_at'],
        'notes' => $row['notes'] ?? '',
        'placedBy' => $row['placed_by'],
        'waiterName' => $row['waiter_name'] ?? '',
        'assignedWaiter' => $row['assigned_waiter'] ?? null,
        'billId' => $row['bill_id'],
        'gstRate' => $row['gst_rate'] !== null ? (float) $row['gst_rate'] : null,
        'halfRate' => $row['half_rate'] !== null ? (float) $row['half_rate'] : null,
        'gstAmount' => $row['gst_amount'] !== null ? (float) $row['gst_amount'] : null,
        'cgstAmount' => $row['cgst_amount'] !== null ? (float) $row['cgst_amount'] : null,
        'sgstAmount' => $row['sgst_amount'] !== null ? (float) $row['sgst_amount'] : null,
        'billSubtotal' => $row['bill_subtotal'] !== null ? (float) $row['bill_subtotal'] : null,
        'billTotal' => $row['bill_total'] !== null ? (float) $row['bill_total'] : null,
        'invoiceNo' => $row['invoice_no'],
        'invoiceGeneratedAt' => $row['invoice_generated_at'] !== null ? (int) $row['invoice_generated_at'] : null,
    ];
}

// Batch-fetches items for a list of order rows in one query (avoids N+1),
// then zips them together into full order objects.
function attach_items(array $orderRows): array {
    if (!$orderRows) return [];
    $ids = array_column($orderRows, 'id');
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = db()->prepare("SELECT * FROM order_items WHERE order_id IN ($placeholders) ORDER BY id");
    $stmt->execute($ids);
    $itemsByOrder = [];
    foreach ($stmt->fetchAll() as $item) {
        $itemsByOrder[$item['order_id']][] = $item;
    }
    return array_map(fn($row) => row_to_order($row, $itemsByOrder[$row['id']] ?? []), $orderRows);
}

function find_all_orders(): array {
    $rows = db()->query('SELECT * FROM orders ORDER BY created_at ASC')->fetchAll();
    return attach_items($rows);
}

function find_orders_by_table(string $table): array {
    $stmt = db()->prepare('SELECT * FROM orders WHERE table_no = ? ORDER BY created_at ASC');
    $stmt->execute([$table]);
    return attach_items($stmt->fetchAll());
}

function find_orders_active_by_table(string $table): array {
    $stmt = db()->prepare("SELECT * FROM orders WHERE table_no = ? AND status != 'paid' ORDER BY created_at ASC");
    $stmt->execute([$table]);
    return attach_items($stmt->fetchAll());
}

function find_orders_by_status(string $table, string $status): array {
    $stmt = db()->prepare('SELECT * FROM orders WHERE table_no = ? AND status = ? ORDER BY created_at ASC');
    $stmt->execute([$table, $status]);
    return attach_items($stmt->fetchAll());
}

// Cross-table status filter (no table_no) — for live staff queues like the
// Waiter view, which only ever renders a couple of statuses at a time and
// otherwise has no reason to pull every order ever placed on every poll.
function find_orders_by_statuses(array $statuses): array {
    if (!$statuses) return [];
    $placeholders = implode(',', array_fill(0, count($statuses), '?'));
    $stmt = db()->prepare("SELECT * FROM orders WHERE status IN ($placeholders) ORDER BY created_at ASC");
    $stmt->execute($statuses);
    return attach_items($stmt->fetchAll());
}

function find_orders_by_bill_id(string $table, string $billId): array {
    $stmt = db()->prepare('SELECT * FROM orders WHERE table_no = ? AND bill_id = ? ORDER BY created_at ASC');
    $stmt->execute([$table, $billId]);
    return attach_items($stmt->fetchAll());
}

function find_orders_by_invoice(string $table, string $invoiceNo): array {
    $stmt = db()->prepare('SELECT * FROM orders WHERE table_no = ? AND invoice_no = ? ORDER BY created_at ASC');
    $stmt->execute([$table, $invoiceNo]);
    return attach_items($stmt->fetchAll());
}
