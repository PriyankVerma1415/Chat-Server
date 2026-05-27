const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { isGroupMember, isGroupAdmin } = require('../middleware/groupMiddleware');
const {
  createGroup,
  getGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  addMember,
  removeMember,
  promoteAdmin,
  demoteAdmin,
  getGroupMessages
} = require('../controllers/groupController');

// All routes require authentication
router.use(protect);

router.post('/create', createGroup);
router.get('/', getGroups);

// Routes requiring member access
router.get('/:id', isGroupMember, getGroupById);
router.get('/:id/messages', isGroupMember, getGroupMessages);

// Routes requiring admin access
router.put('/:id', isGroupAdmin, updateGroup);
router.delete('/:id', isGroupAdmin, deleteGroup);
router.post('/:id/add-member', isGroupAdmin, addMember);
router.post('/:id/remove-member', isGroupAdmin, removeMember);
router.post('/:id/promote-admin', isGroupAdmin, promoteAdmin);
router.post('/:id/demote-admin', isGroupAdmin, demoteAdmin);

module.exports = router;
