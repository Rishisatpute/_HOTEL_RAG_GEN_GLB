const mongoose = require('mongoose');

// Mirrors the order object shape orders.js has always produced, so the API
// can return documents the frontend already knows how to render without
// any reshaping.
const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  qty: { type: Number, required: true, min: 1 },
  special: { type: Boolean, default: false }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // friendly id, e.g. "EP1A2B3C4D5"
  table: { type: String, required: true },
  items: { type: [itemSchema], required: true },
  status: {
    type: String,
    enum: ['new', 'preparing', 'ready', 'delivered', 'bill_requested', 'paid'],
    default: 'new'
  },
  paymentMethodRequested: { type: String, default: null },
  paymentMethod: { type: String, default: null },
  billRequestedAt: { type: Number, default: null },
  paidAt: { type: Number, default: null },
  createdAt: { type: Number, required: true },
  updatedAt: { type: Number, required: true },
  notes: { type: String, default: '' },
  placedBy: { type: String, enum: ['customer', 'waiter'], default: 'customer' },
  waiterName: { type: String, default: '' },
  billId: { type: String, default: null },

  // Set once by generateInvoice() and never recalculated after that, so a
  // bill's GST/total stays fixed even if the GST rate changes later.
  gstRate: Number,
  halfRate: Number,
  gstAmount: Number,
  cgstAmount: Number,
  sgstAmount: Number,
  billSubtotal: Number,
  billTotal: Number,
  invoiceNo: String,
  invoiceGeneratedAt: Number
}, {
  versionKey: false,
  // Orders already carry their own createdAt/updatedAt (ms timestamps, set by
  // the app code) — Mongoose's automatic Date-based timestamps would be redundant.
  timestamps: false
});

// The frontend's own id is what every lookup uses, not Mongo's _id — its
// unique index is already declared on the field above (`unique: true`).
orderSchema.index({ table: 1 });

module.exports = mongoose.model('Order', orderSchema);
