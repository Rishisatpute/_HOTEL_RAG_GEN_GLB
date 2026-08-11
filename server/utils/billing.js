// Server-side mirror of orders.js's priceNumber/itemTotal/orderTotal/billBreakdown —
// this is now the single source of truth for money math (the frontend just displays
// whatever the server computed, instead of computing it itself).
const GST_RATE = 5; // fixed restaurant-wide rate, same as the old client-side constant

function priceNumber(p) {
  if (typeof p === 'number') return p;
  const m = String(p).match(/[\d.]+/);
  return m ? parseFloat(m[0]) : 0;
}

function itemTotal(it) {
  return priceNumber(it.price) * (it.qty || 1);
}

function orderTotal(order) {
  return order.items.reduce((s, it) => s + itemTotal(it), 0);
}

// subtotal -> { subtotal, rate, halfRate, gst, cgst, sgst, total }, rounded to paise.
// GST is split evenly into CGST + SGST, as required for an intra-state (same-state) sale.
function billBreakdown(subtotal, rate) {
  const r = rate == null ? GST_RATE : rate;
  const gstAmount = Math.round(subtotal * r / 100 * 100) / 100;
  const halfRate = Math.round(r / 2 * 100) / 100;
  const half = Math.round(gstAmount / 2 * 100) / 100;
  return {
    subtotal,
    rate: r,
    halfRate,
    gst: gstAmount,
    cgst: half,
    sgst: half,
    total: Math.round((subtotal + gstAmount) * 100) / 100
  };
}

module.exports = { GST_RATE, priceNumber, itemTotal, orderTotal, billBreakdown };
