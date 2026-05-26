const express = require('express');
const { syncContacts } = require('../controllers/contactController');
const { protect } = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting for contact syncing to prevent abuse
const syncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 sync requests per windowMs
  message: 'Too many contact sync requests, please try again later.',
});

router.post('/sync', protect, syncLimiter, syncContacts);

module.exports = router;
