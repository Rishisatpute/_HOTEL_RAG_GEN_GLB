const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  reservationId: { type: String, required: true, unique: true },
  customerName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  bookingDate: { type: String, required: true },
  bookingTime: { type: String, required: true },
  guestCount: { type: Number, required: true, min: 1, max: 12 },
  occasion: { type: String, default: '' },
  specialRequests: { type: String, default: '' },
  dietary: [{ type: String }],
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'confirmed'
  }
}, { timestamps: true });

module.exports = mongoose.model('Reservation', reservationSchema);
