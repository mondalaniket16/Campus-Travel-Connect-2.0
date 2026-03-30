const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema({
  type: { type: String, enum: ['match', 'group'], default: 'match' },
  uid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String },
  photoURL: { type: String },
  from: { type: String },
  to: { type: String },
  date: { type: String },
  time: { type: String },
  vehicle: { type: String },
  gender: { type: String, default: 'Any' },
  notes: { type: String, maxlength: 500 },
  maxMembers: { type: Number, default: 4 },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Listing', listingSchema);