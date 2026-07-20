const express = require('express');
const Reservation = require('../models/Reservation');
const { generateId } = require('../utils/generateId');
const { emitReservationEvent } = require('../socket');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const reservations = await Reservation.find().sort({ createdAt: -1 });
    res.json({ success: true, data: reservations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      customerName,
      email,
      phone,
      bookingDate,
      bookingTime,
      guestCount,
      occasion,
      specialRequests,
      dietary
    } = req.body;

    if (!customerName || !email || !phone || !bookingDate || !bookingTime || !guestCount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required booking fields'
      });
    }

    const reservation = await Reservation.create({
      reservationId: generateId('RES'),
      customerName,
      email,
      phone,
      bookingDate,
      bookingTime,
      guestCount,
      occasion: occasion || '',
      specialRequests: specialRequests || '',
      dietary: dietary || [],
      status: 'confirmed'
    });

    emitReservationEvent(req.app, 'reservation:new', reservation);

    res.status(201).json({ success: true, data: reservation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/:reservationId/status', async (req, res) => {
  try {
    const { status } = req.body;
    const reservation = await Reservation.findOneAndUpdate(
      { reservationId: req.params.reservationId },
      { status },
      { new: true }
    );

    if (!reservation) {
      return res.status(404).json({ success: false, message: 'Reservation not found' });
    }

    res.json({ success: true, data: reservation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
