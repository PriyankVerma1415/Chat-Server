const Group = require('../models/Group');

const isGroupMember = async (req, res, next) => {
  try {
    const groupId = req.params.id || req.body.groupId;
    if (!groupId) return res.status(400).json({ message: 'Group ID is required' });

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const isMember = group.members.some(member => member.user.toString() === req.user._id.toString());
    
    if (!isMember) {
      return res.status(403).json({ message: 'You are not a member of this group' });
    }

    req.group = group; // Attach group to request for next middleware/controller
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const isGroupAdmin = async (req, res, next) => {
  try {
    const groupId = req.params.id || req.body.groupId;
    if (!groupId) return res.status(400).json({ message: 'Group ID is required' });

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const member = group.members.find(m => m.user.toString() === req.user._id.toString());
    
    if (!member || member.role !== 'admin') {
      return res.status(403).json({ message: 'Admin permissions required' });
    }

    req.group = group;
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { isGroupMember, isGroupAdmin };
