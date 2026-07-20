const express = require('express');
const Order = require('../models/Order');
const { generateId } = require('../utils/generateId');
const { emitOrderEvent } = require('../socket');

const router = express.Router();
const GST_RATE = 0.07;

router.get('/', async (req, res) => {
  try {
    const { status, kitchen, counter, unpaid } = req.query;
    const filter = {};

    if (status) filter.orderStatus = status;
    if (kitchen === 'true') {
      filter.orderStatus = { $in: ['received', 'preparing', 'ready'] };
    }
    if (counter === 'true') {
      filter.orderStatus = { $ne: 'cancelled' };
    }
    if (unpaid === 'true') {
      filter.paymentStatus = 'pending';
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:orderId', async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  console.log('[ORDER API] POST /api/orders', req.body);
  try {
    const {
      tableNumber,
      customerName,
      phone,
      address,
      paymentMethod,
      specialInstructions,
      items,
      subtotal,
      gst,
      tax,
      total,
      orderType
    } = req.body;

    if (!customerName || !items?.length) {
      return res.status(400).json({
        success: false,
        message: 'Required: customerName and items'
      });
    }

    if (orderType === 'dine-in' && !tableNumber) {
      return res.status(400).json({
        success: false,
        message: 'Dine-in orders require a table number'
      });
    }

    if (orderType === 'delivery' && !address) {
      return res.status(400).json({
        success: false,
        message: 'Delivery orders require an address'
      });
    }

    const calcSubtotal = subtotal ?? items.reduce((s, i) => s + i.price * i.quantity, 0);
    const calcGst = gst ?? calcSubtotal * GST_RATE;
    const calcTotal = total ?? calcSubtotal + calcGst;

    const order = await Order.create({
      orderId: generateId('ORD'),
      orderType: orderType || 'dine-in',
      tableNumber: String(tableNumber || ''),
      customerName,
      phone: phone || '',
      address: address || '',
      paymentMethod: paymentMethod || '',
      specialInstructions: specialInstructions || '',
      items,
      subtotal: calcSubtotal,
      gst: calcGst,
      tax: tax || calcGst,
      total: calcTotal,
      paymentStatus: 'pending',
      orderStatus: 'received'
    });

    console.log('[ORDER API] Order saved', order.orderId);
    emitOrderEvent(req.app, 'order:new', order);
    console.log('[ORDER API] Event emitted order:new', order.orderId);
    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order,
      data: order
    });
  } catch (error) {
    console.error('[ORDER API] Error saving order', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to place order' });
  }
});

router.patch('/:orderId/status', async (req, res) => {
  try {
    const { orderStatus } = req.body;
    const order = await Order.findOneAndUpdate(
      { orderId: req.params.orderId },
      { orderStatus },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    emitOrderEvent(req.app, 'order:updated', order);
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/:orderId/payment', async (req, res) => {
  try {
    const { paymentMethod, paymentStatus, invoiceGenerated } = req.body;
    const update = {};

    if (paymentMethod) update.paymentMethod = paymentMethod;
    if (paymentStatus) update.paymentStatus = paymentStatus;
    if (invoiceGenerated !== undefined) update.invoiceGenerated = invoiceGenerated;

    const order = await Order.findOneAndUpdate(
      { orderId: req.params.orderId },
      update,
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    emitOrderEvent(req.app, 'order:payment', order);
    emitOrderEvent(req.app, 'order:updated', order);
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
