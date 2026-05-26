const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    username: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      default: '',
    },
    bio: {
      type: String,
      trim: true,
      default: 'Available',
    },
    avatar: {
      type: String,
      default: '',
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    onlineStatus: {
      type: String,
      enum: ['online', 'offline'],
      default: 'offline',
    },
    refreshToken: {
      type: String,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    lastLogin: {
      type: Date,
    },
    profileCompleted: {
      type: Boolean,
      default: false,
    },
    contacts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Phone auth removes the need for password hashing and matching hooks.

const User = mongoose.model('User', userSchema);

module.exports = User;
