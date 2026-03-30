const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  type: { type: String, enum: ['group', 'match'], default: 'group' },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  from: { type: String, default: 'VIT Chennai' },
  to: { type: String, required: true },
  date: { type: String, required: true },
  mode: { type: String, enum: ['Train', 'Flight', 'Bus', 'Car', 'Cab', 'Auto', 'Anything'], required: true },
  gender: { type: String, enum: ['No Preference', 'Male', 'Female'], default: 'No Preference' },
  maxMembers: { type: Number, min: 2, max: 20, default: 4 },
  extraInfo: { type: String, maxlength: 500 },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Ensure creator is always a member
groupSchema.pre('save', function(next) {
  if (!this.members.includes(this.creator)) {
    this.members.push(this.creator);
  }
  next();
});

// Virtual for member count
groupSchema.virtual('memberCount').get(function() {
  return this.members.length;
});

groupSchema.set('toJSON', { virtuals: true });
groupSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Group', groupSchema);