const mongoose = require('mongoose');

// A single document (_id: 'invoice') whose seq field increments atomically,
// so two staff clicking "Generate Invoice" at the same moment can never be
// handed the same invoice number — the old localStorage version only had to
// worry about one browser at a time, this one has to worry about several.
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

const Counter = mongoose.model('Counter', counterSchema);

async function nextInvoiceNumber() {
  const counter = await Counter.findByIdAndUpdate(
    'invoice',
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return 'INV-EKP-' + String(counter.seq).padStart(6, '0');
}

module.exports = { nextInvoiceNumber };
