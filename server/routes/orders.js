const express = require('express');
const Order = require('../models/Order');
const { genId } = require('../utils/generateId');
const { orderTotal, billBreakdown } = require('../utils/billing');
const { nextInvoiceNumber } = require('../models/Counter');
const { emitEvent } = require('../socket');

const router = express.Router();

// Shared by the /generate-invoice route and /confirm-payment (which needs the
// same idempotent lock-in step first) — kept as a plain function so
// confirm-payment can call it in-process instead of making an HTTP request
// back to its own server.
async function generateInvoiceForTable(table) {
  const pending = await Order.find({ table, status: 'bill_requested' });
  if (pending.length === 0) return [];
  if (pending[0].invoiceNo) return pending;

  const now = Date.now();
  const subtotal = pending.reduce((s, o) => s + orderTotal(o), 0);
  const bill = billBreakdown(subtotal);
  const invoiceNo = await nextInvoiceNumber();

  await Order.updateMany(
    { table, status: 'bill_requested' },
    {
      gstRate: bill.rate, halfRate: bill.halfRate, gstAmount: bill.gst,
      cgstAmount: bill.cgst, sgstAmount: bill.sgst,
      billSubtotal: bill.subtotal, billTotal: bill.total,
      invoiceNo, invoiceGeneratedAt: now, updatedAt: now
    }
  );

  return Order.find({ table, invoiceNo });
}

// GET /api/orders  — mirrors OrderStore.getAll()
router.get('/', async (req, res) => {
  const orders = await Order.find().sort({ createdAt: 1 });
  res.json(orders);
});

// GET /api/orders/table/:table  — mirrors OrderStore.getByTable(table)
router.get('/table/:table', async (req, res) => {
  const orders = await Order.find({ table: req.params.table }).sort({ createdAt: 1 });
  res.json(orders);
});

// GET /api/orders/table/:table/active  — mirrors OrderStore.getActiveByTable(table)
router.get('/table/:table/active', async (req, res) => {
  const orders = await Order.find({ table: req.params.table, status: { $ne: 'paid' } }).sort({ createdAt: 1 });
  res.json(orders);
});

// POST /api/orders  — mirrors OrderStore.createOrder({ table, items, notes, placedBy, waiterName })
router.post('/', async (req, res) => {
  try {
    const { table, items, notes, placedBy, waiterName } = req.body;
    if (!items || !items.length) {
      return res.status(400).json({ error: 'items is required' });
    }
    const now = Date.now();
    const order = await Order.create({
      id: genId(),
      table: table || 'Takeaway',
      items: items.map(it => ({ name: it.name, price: it.price, qty: it.qty || 1, special: !!it.special })),
      status: 'new',
      createdAt: now,
      updatedAt: now,
      notes: notes || '',
      placedBy: placedBy === 'waiter' ? 'waiter' : 'customer',
      waiterName: waiterName || ''
    });
    emitEvent(req.app, 'order_created', order);
    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/orders/:id  — mirrors OrderStore.updateOrder(id, patch)
// Used for status moves: new -> preparing -> ready -> delivered
router.patch('/:id', async (req, res) => {
  const order = await Order.findOneAndUpdate(
    { id: req.params.id },
    { ...req.body, updatedAt: Date.now() },
    { new: true }
  );
  if (!order) return res.status(404).json({ error: 'Order not found' });
  emitEvent(req.app, 'order_updated', order);
  res.json(order);
});

// POST /api/orders/table/:table/request-bill  — mirrors OrderStore.requestBill(table, method)
// Every DELIVERED order at the table moves to bill_requested, grouped under one billId.
router.post('/table/:table/request-bill', async (req, res) => {
  const { table } = req.params;
  const { method } = req.body;
  const now = Date.now();
  const billId = genId();

  const result = await Order.updateMany(
    { table, status: 'delivered' },
    { status: 'bill_requested', paymentMethodRequested: method, billRequestedAt: now, billId, updatedAt: now }
  );
  if (result.matchedCount === 0) return res.json([]);

  const orders = await Order.find({ table, billId });
  emitEvent(req.app, 'bill_requested', { table, method, orders });
  res.json(orders);
});

// POST /api/orders/table/:table/generate-invoice  — mirrors OrderStore.generateInvoice(table)
// Idempotent: calling it again just returns the already-generated invoice.
router.post('/table/:table/generate-invoice', async (req, res) => {
  const orders = await generateInvoiceForTable(req.params.table);
  if (orders.length) emitEvent(req.app, 'invoice_generated', { table: req.params.table, orders });
  res.json(orders);
});

// POST /api/orders/table/:table/confirm-payment  — mirrors OrderStore.confirmPayment(table)
router.post('/table/:table/confirm-payment', async (req, res) => {
  const { table } = req.params;

  // Ensures a bill that skipped straight to "Confirm Payment" still gets a
  // locked-in invoice number and GST split first.
  const generated = await generateInvoiceForTable(table);
  if (generated.length === 0) return res.json([]);

  const pending = await Order.find({ table, status: 'bill_requested' });
  const method = pending[0].paymentMethodRequested;
  const now = Date.now();

  await Order.updateMany(
    { table, status: 'bill_requested' },
    { status: 'paid', paymentMethod: method, paidAt: now, updatedAt: now }
  );

  const orders = await Order.find({ table, paidAt: now });
  emitEvent(req.app, 'order_paid', { table, method, orders });
  res.json(orders);
});

module.exports = router;
