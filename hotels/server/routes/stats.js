const express = require('express');
const Order = require('../models/Order');
const Reservation = require('../models/Reservation');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrders = await Order.find({ createdAt: { $gte: today } });
    const allOrders = await Order.find();
    const reservations = await Reservation.find();
    const pendingOrders = await Order.countDocuments({
      orderStatus: { $in: ['received', 'preparing', 'ready', 'pending', 'accepted'] }
    });

    const todayRevenue = todayOrders.reduce((sum, o) => sum + o.total, 0);
    const totalRevenue = allOrders.reduce((sum, o) => sum + o.total, 0);

    const statusCounts = {};
    allOrders.forEach((o) => {
      statusCounts[o.orderStatus] = (statusCounts[o.orderStatus] || 0) + 1;
    });

    const paymentCounts = { paid: 0, pending: 0, failed: 0 };
    allOrders.forEach((o) => {
      paymentCounts[o.paymentStatus] = (paymentCounts[o.paymentStatus] || 0) + 1;
    });

    const itemSales = {};
    allOrders.forEach((order) => {
      order.items.forEach((item) => {
        if (!itemSales[item.name]) {
          itemSales[item.name] = { quantity: 0, revenue: 0 };
        }
        itemSales[item.name].quantity += item.quantity;
        itemSales[item.name].revenue += item.price * item.quantity;
      });
    });

    const topItems = Object.entries(itemSales)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);

      const dayOrders = allOrders.filter(
        (o) => o.createdAt >= d && o.createdAt < next
      );
      last7Days.push({
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        revenue: dayOrders.reduce((s, o) => s + o.total, 0),
        orders: dayOrders.length
      });
    }

    const uniqueCustomers = new Set(allOrders.map((o) => o.phone)).size;

    res.json({
      success: true,
      data: {
        todayOrders: todayOrders.length,
        todayRevenue,
        totalCustomers: uniqueCustomers,
        pendingOrders,
        totalRevenue,
        totalReservations: reservations.length,
        statusCounts,
        paymentCounts,
        topItems,
        last7Days,
        recentOrders: allOrders.slice(0, 10)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
