const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      type: String,
      required: false,
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'video', 'audio', 'voice', 'document'],
      default: 'text',
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
    },
    mediaUrl: {
      type: String,
    },
    fileName: {
      type: String,
    },
    fileSize: {
      type: Number,
    },
    duration: {
      type: Number,
    },
    thumbnailUrl: {
      type: String,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
