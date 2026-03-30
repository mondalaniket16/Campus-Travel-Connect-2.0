const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  fromUid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toUid: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, maxlength: 500 },
}, { timestamps: true });

module.exports = mongoose.model('Rating', ratingSchema);