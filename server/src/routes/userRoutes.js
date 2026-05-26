const express = require('express');
const { getUsers, updateProfile } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/').get(protect, getUsers);
router.route('/profile').put(protect, updateProfile);

module.exports = router;
