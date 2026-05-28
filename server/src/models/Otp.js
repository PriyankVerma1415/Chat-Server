const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  otp: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300, // Document is automatically deleted after 5 minutes (300 seconds)
  },
});

// Hash the OTP before saving
otpSchema.pre('save', async function () {
  if (!this.isModified('otp')) return;
  const salt = await bcrypt.genSalt(10);
  this.otp = await bcrypt.hash(this.otp, salt);
});

// Method to verify OTP
otpSchema.methods.verifyOtp = async function (enteredOtp) {
  return await bcrypt.compare(enteredOtp, this.otp);
};

const Otp = mongoose.model('Otp', otpSchema);

module.exports = Otp;
