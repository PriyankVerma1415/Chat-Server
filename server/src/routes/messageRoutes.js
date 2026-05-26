const express = require('express');
const { getMessages, sendMessage, getConversations, deleteMessage, clearChat, editMessage } = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/conversations').get(protect, getConversations);
router.route('/:userId').get(protect, getMessages);
router.route('/').post(protect, sendMessage);
router.route('/:messageId')
  .put(protect, editMessage)
  .delete(protect, deleteMessage);
router.route('/conversation/:conversationId').delete(protect, clearChat);

module.exports = router;
