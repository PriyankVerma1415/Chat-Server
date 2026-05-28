const express = require('express');
const rateLimit = require('express-rate-limit');
const { sendOtp, verifyOtp, refreshAuthToken, logoutUser, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Rate limiting for OTP endpoints
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // limit each IP to 5 OTP requests per windowMs
  message: 'Too many OTP requests, please try again later.',
});

router.post('/send-otp', otpLimiter, sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/refresh', refreshAuthToken);
router.post('/logout', logoutUser);
router.get('/me', protect, getMe);

module.exports = router;
