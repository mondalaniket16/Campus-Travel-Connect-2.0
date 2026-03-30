const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, minlength: 6 },
  reg: { type: String, trim: true },
  phone: { type: String, trim: true },
  dept: { type: String, trim: true },
  bio: { type: String, maxlength: 500 },
  photoURL: { type: String, default: '' },
  extraEmail: { type: String, trim: true },
  extraPhone: { type: String, trim: true },
  authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
  googleId: { type: String },
  isVerified: { type: Boolean, default: false },
  lastLogin: { type: Date },
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive fields from JSON output
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);