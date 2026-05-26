const User = require('../models/User');
const jwt = require('jsonwebtoken');
const admin = require('../config/firebaseAdmin');

const generateAccessToken = (id) => {
  return jwt.sign({ id }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: '15m',
  });
};

const generateRefreshToken = (id, tokenVersion) => {
  return jwt.sign({ id, tokenVersion }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: '7d',
  });
};

const setTokenCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

const verifyPhoneAuth = async (req, res) => {
  try {
    const { idToken, username, email } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: 'Firebase ID Token is required' });
    }

    if (!admin || !admin.apps.length) {
      return res.status(500).json({ message: 'Server configuration error: Firebase Admin not initialized' });
    }

    // Verify token with Firebase
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const phoneNumber = decodedToken.phone_number;

    if (!phoneNumber) {
      return res.status(400).json({ message: 'Invalid token: No phone number present' });
    }

    let user = await User.findOne({ phoneNumber });

    if (!user) {
      // First time login -> register
      user = await User.create({
        phoneNumber,
        username: username || '',
        email: email || '',
        lastLogin: Date.now(),
      });
    } else {
      user.lastLogin = Date.now();
      // Optionally update username and email if provided and not yet set
      if (username && !user.username) {
        user.username = username;
      }
      if (email && !user.email) {
        user.email = email;
      }
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id, user.tokenVersion);

    user.refreshToken = refreshToken;
    await user.save();

    setTokenCookie(res, refreshToken);

    res.json({
      _id: user._id,
      phoneNumber: user.phoneNumber,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      bio: user.bio,
      profileCompleted: user.profileCompleted,
      token: accessToken,
    });
  } catch (error) {
    console.error('Firebase Auth Error:', error);
    res.status(401).json({ message: 'Unauthorized: Invalid Firebase token' });
  }
};

const refreshAuthToken = async (req, res) => {
  const token = req.cookies.refreshToken;

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no refresh token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || user.refreshToken !== token || user.tokenVersion !== decoded.tokenVersion) {
      return res.status(401).json({ message: 'Not authorized, invalid refresh token' });
    }

    // Optional Token Rotation: Generate a new refresh token every time it's used
    user.tokenVersion += 1;
    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id, user.tokenVersion);

    user.refreshToken = newRefreshToken;
    await user.save();

    setTokenCookie(res, newRefreshToken);

    res.json({ token: newAccessToken });
  } catch (error) {
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

const logoutUser = async (req, res) => {
  const token = req.cookies.refreshToken;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
      const user = await User.findById(decoded.id);
      
      if (user) {
        user.refreshToken = '';
        user.tokenVersion += 1; // Invalidate old tokens completely
        await user.save();
      }
    } catch (error) {
      // Even if verification fails, we clear the cookie
    }
  }

  res.cookie('refreshToken', '', {
    httpOnly: true,
    expires: new Date(0),
  });
  
  res.status(200).json({ message: 'Logged out successfully' });
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      res.json({
        _id: user._id,
        phoneNumber: user.phoneNumber,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        profileCompleted: user.profileCompleted,
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { verifyPhoneAuth, refreshAuthToken, logoutUser, getMe };
