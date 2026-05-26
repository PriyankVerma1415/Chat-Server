const express = require('express');
const { verifyPhoneAuth, refreshAuthToken, logoutUser, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/verify-phone', verifyPhoneAuth);
router.post('/refresh', refreshAuthToken);
router.post('/logout', logoutUser);
router.get('/me', protect, getMe);

module.exports = router;
