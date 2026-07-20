const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  id: { type: Number },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },
  image: { type: String, default: '' }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  orderType: {
    type: String,
    enum: ['dine-in', 'delivery'],
    default: 'dine-in'
  },
  tableNumber: { type: String, default: '' },
  customerName: { type: String, required: true },
  specialInstructions: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  items: [orderItemSchema],
  subtotal: { type: Number, required: true },
  gst: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  total: { type: Number, required: true },
  paymentMethod: {
    type: String,
    enum: ['', 'cash', 'card', 'upi', 'online'],
    default: ''
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  orderStatus: {
    type: String,
    enum: ['received', 'preparing', 'ready', 'served', 'cancelled'],
    default: 'received'
  },
  invoiceGenerated: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
