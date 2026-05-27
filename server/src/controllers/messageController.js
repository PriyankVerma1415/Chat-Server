const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Group = require('../models/Group');
const User = require('../models/User');

// Fetch all messages for a specific conversation
const getMessages = async (req, res) => {
  try {
    const { userId } = req.params; // The other user's ID
    const currentUserId = req.user._id;

    const conversation = await Conversation.findOne({
      participants: { $all: [currentUserId, userId] },
    });

    if (!conversation) {
      return res.json([]);
    }

    const messages = await Message.find({ 
      conversationId: conversation._id, 
      isDeleted: { $ne: true },
      deletedBy: { $ne: currentUserId }
    })
      .sort({ createdAt: 1 })
      .populate('senderId', 'username avatar email')
      .populate('receiverId', 'username avatar email')
      .populate({
        path: 'replyTo',
        select: 'message messageType mediaUrl fileName senderId isDeleted',
        populate: { path: 'senderId', select: 'username' }
      })
      .populate('seenBy', 'username avatar phoneNumber');

    // Mark unread messages as read (1-on-1 chats)
    await Message.updateMany(
      { conversationId: conversation._id, receiverId: currentUserId, status: { $ne: 'read' } },
      { $set: { status: 'read' } }
    );

    // Track group reads
    if (conversation.isGroup) {
      await Message.updateMany(
        { conversationId: conversation._id, senderId: { $ne: currentUserId } },
        { $addToSet: { seenBy: currentUserId } }
      );
    }

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Send a message
const sendMessage = async (req, res) => {
  try {
    const { receiverId, groupId, message, messageType, mediaUrl, fileName, fileSize, duration, replyTo } = req.body;
    const senderId = req.user._id;

    if (!receiverId && !groupId) {
      return res.status(400).json({ message: 'Please provide receiver or group' });
    }
    if (!message && !mediaUrl) {
      return res.status(400).json({ message: 'Please provide message or media' });
    }

    let conversation = null;
    let group = null;

    if (groupId) {
      group = await Group.findById(groupId);
      if (!group) return res.status(404).json({ message: 'Group not found' });
      if (!group.members.some(m => m.user.toString() === senderId.toString())) {
        return res.status(403).json({ message: 'Not a member of this group' });
      }
    } else {
      conversation = await Conversation.findOne({
        participants: { $all: [senderId, receiverId] },
      });

      if (!conversation) {
        conversation = await Conversation.create({
          participants: [senderId, receiverId],
        });
      }
    }

    const newMessage = await Message.create({
      senderId,
      receiverId: receiverId || undefined,
      groupId: groupId || undefined,
      message,
      messageType: messageType || 'text',
      mediaUrl,
      fileName,
      fileSize,
      duration,
      replyTo,
      conversationId: conversation ? conversation._id : undefined,
    });

    if (groupId) {
      group.lastMessage = newMessage._id;
      await group.save();
    } else {
      conversation.lastMessage = newMessage._id;
      await conversation.save();
    }

    await newMessage.populate('senderId', 'username avatar email');
    if (receiverId) {
      await newMessage.populate('receiverId', 'username avatar email');
    }
    if (replyTo) {
      await newMessage.populate({
        path: 'replyTo',
        select: 'message messageType mediaUrl fileName senderId isDeleted',
        populate: { path: 'senderId', select: 'username' }
      });
    }

    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all conversations for current user
const getConversations = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    
    const conversations = await Conversation.find({
      participants: currentUserId,
    })
      .populate('participants', 'username avatar email phoneNumber bio onlineStatus lastSeen')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });

    const conversationsWithUnread = await Promise.all(conversations.map(async (conv) => {
      const unreadCount = await Message.countDocuments({
        conversationId: conv._id,
        receiverId: currentUserId,
        status: { $ne: 'read' }
      });
      return {
        ...conv.toObject(),
        unreadCount
      };
    }));

    res.json(conversationsWithUnread);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a sent message
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.user._id;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.senderId.toString() !== currentUserId.toString()) {
      return res.status(403).json({ message: 'You can only delete your own messages' });
    }

    if (message.mediaUrl) {
      try {
        const admin = require('../config/firebaseAdmin');
        const bucket = admin.storage().bucket();
        // Extract file path from URL
        let filePath = message.mediaUrl.split('/o/')[1]; 
        if (filePath) {
          filePath = filePath.split('?')[0]; 
          filePath = decodeURIComponent(filePath); 
          await bucket.file(filePath).delete();
          console.log(`Deleted ${filePath} from Firebase Storage`);
        }
      } catch (err) {
        console.error('Failed to delete file from Firebase Storage:', err);
      }
    }

    await Message.findByIdAndDelete(messageId);

    res.json({ message: 'Message permanently deleted', messageId });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Clear entire chat
const clearChat = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const currentUserId = req.user._id;
    const Conversation = require('../models/Conversation');

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    if (!conversation.participants.includes(currentUserId)) {
      return res.status(403).json({ message: 'Not authorized to clear this chat' });
    }

    // Add current user to deletedBy array for all messages in conversation
    await Message.updateMany(
      { conversationId },
      { $addToSet: { deletedBy: currentUserId } }
    );

    // If both participants deleted the chat, permanently delete those messages to save space
    const messagesToDeletePermanently = await Message.find({ 
      conversationId, 
      $expr: { $eq: [{ $size: "$deletedBy" }, 2] } 
    });
    
    if (messagesToDeletePermanently.length > 0) {
      const admin = require('../config/firebaseAdmin');
      const bucket = admin.storage().bucket();
      
      for (const msg of messagesToDeletePermanently) {
        if (msg.mediaUrl) {
          try {
            let filePath = msg.mediaUrl.split('/o/')[1]; 
            if (filePath) {
              filePath = filePath.split('?')[0]; 
              filePath = decodeURIComponent(filePath); 
              await bucket.file(filePath).delete().catch(() => {});
            }
          } catch (err) {}
        }
        await Message.findByIdAndDelete(msg._id);
      }
    }

    res.json({ message: 'Chat cleared successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Edit a message
const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { newText } = req.body;
    const currentUserId = req.user._id;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.senderId.toString() !== currentUserId.toString()) {
      return res.status(403).json({ message: 'You can only edit your own messages' });
    }

    if (message.messageType !== 'text') {
      return res.status(400).json({ message: 'Only text messages can be edited' });
    }

    // Check 5 minutes window
    const now = new Date();
    const createdAt = new Date(message.createdAt);
    if (now - createdAt > 5 * 60 * 1000) {
      return res.status(403).json({ message: 'Messages can only be edited within 5 minutes of sending' });
    }

    message.message = newText;
    message.isEdited = true;
    await message.save();

    await message.populate('senderId', 'username avatar email');
    await message.populate('receiverId', 'username avatar email');
    if (message.replyTo) {
      await message.populate({
        path: 'replyTo',
        select: 'message messageType mediaUrl fileName senderId isDeleted',
        populate: { path: 'senderId', select: 'username' }
      });
    }

    res.json(message);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getMessages, sendMessage, getConversations, deleteMessage, clearChat, editMessage };
