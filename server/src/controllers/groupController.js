const Group = require('../models/Group');
const Message = require('../models/Message');
const User = require('../models/User');

const createGroup = async (req, res) => {
  try {
    const { name, description, avatar, memberIds } = req.body;
    const currentUserId = req.user._id;

    if (!name) return res.status(400).json({ message: 'Group name is required' });

    // Ensure creator is an admin member
    const members = [{ user: currentUserId, role: 'admin' }];
    
    if (memberIds && Array.isArray(memberIds)) {
      memberIds.forEach(id => {
        if (id.toString() !== currentUserId.toString()) {
          members.push({ user: id, role: 'member' });
        }
      });
    }

    const newGroup = await Group.create({
      name,
      description,
      avatar,
      createdBy: currentUserId,
      members
    });

    const populatedGroup = await Group.findById(newGroup._id).populate('members.user', 'username avatar email phoneNumber onlineStatus lastSeen');

    res.status(201).json(populatedGroup);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getGroups = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    const groups = await Group.find({ 'members.user': currentUserId })
      .populate('members.user', 'username avatar email phoneNumber onlineStatus lastSeen')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });

    const groupsWithUnread = await Promise.all(groups.map(async (group) => {
      const unreadCount = await Message.countDocuments({
        groupId: group._id,
        senderId: { $ne: currentUserId },
        seenBy: { $ne: currentUserId }
      });
      return {
        ...group.toObject(),
        unreadCount
      };
    }));

    res.json(groupsWithUnread);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getGroupById = async (req, res) => {
  try {
    // req.group is already populated if isGroupMember is used, but we want full population
    const group = await Group.findById(req.group._id)
      .populate('members.user', 'username avatar email phoneNumber onlineStatus bio lastSeen')
      .populate('lastMessage');
      
    res.json(group);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateGroup = async (req, res) => {
  try {
    const { name, description, avatar } = req.body;
    const group = req.group;

    if (name) group.name = name;
    if (description !== undefined) group.description = description;
    if (avatar !== undefined) group.avatar = avatar;

    await group.save();
    
    const updatedGroup = await Group.findById(group._id).populate('members.user', 'username avatar email phoneNumber onlineStatus lastSeen');
    res.json(updatedGroup);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteGroup = async (req, res) => {
  try {
    await Group.findByIdAndDelete(req.group._id);
    await Message.deleteMany({ groupId: req.group._id });
    res.json({ message: 'Group deleted successfully', groupId: req.group._id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const addMember = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'User ID required' });

    const group = req.group;
    if (group.members.some(m => m.user.toString() === userId.toString())) {
      return res.status(400).json({ message: 'User is already a member' });
    }

    group.members.push({ user: userId, role: 'member' });
    await group.save();

    const updatedGroup = await Group.findById(group._id).populate('members.user', 'username avatar email phoneNumber onlineStatus lastSeen');
    res.json(updatedGroup);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const removeMember = async (req, res) => {
  try {
    const { userId } = req.body;
    const group = req.group;

    group.members = group.members.filter(m => m.user.toString() !== userId.toString());
    await group.save();

    const updatedGroup = await Group.findById(group._id).populate('members.user', 'username avatar email phoneNumber onlineStatus lastSeen');
    res.json(updatedGroup);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const promoteAdmin = async (req, res) => {
  try {
    const { userId } = req.body;
    const group = req.group;

    const member = group.members.find(m => m.user.toString() === userId.toString());
    if (!member) return res.status(404).json({ message: 'Member not found in group' });

    member.role = 'admin';
    await group.save();

    const updatedGroup = await Group.findById(group._id).populate('members.user', 'username avatar email phoneNumber onlineStatus lastSeen');
    res.json(updatedGroup);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const demoteAdmin = async (req, res) => {
  try {
    const { userId } = req.body;
    const group = req.group;

    const member = group.members.find(m => m.user.toString() === userId.toString());
    if (!member) return res.status(404).json({ message: 'Member not found in group' });
    
    if (userId.toString() === req.user._id.toString()) {
        return res.status(400).json({ message: 'You cannot demote yourself' });
    }

    member.role = 'member';
    await group.save();

    const updatedGroup = await Group.findById(group._id).populate('members.user', 'username avatar email phoneNumber onlineStatus lastSeen');
    res.json(updatedGroup);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getGroupMessages = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const messages = await Message.find({ 
      groupId: req.group._id,
      isDeleted: { $ne: true },
      deletedBy: { $ne: currentUserId }
    })
      .sort({ createdAt: 1 })
      .populate('senderId', 'username avatar email')
      .populate({
        path: 'replyTo',
        select: 'message messageType mediaUrl fileName senderId isDeleted',
        populate: { path: 'senderId', select: 'username' }
      })
      .populate('seenBy', 'username avatar phoneNumber');

    // Basic seenBy tracking update
    await Message.updateMany(
      { groupId: req.group._id, seenBy: { $ne: currentUserId } },
      { $addToSet: { seenBy: currentUserId } }
    );

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
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
};
