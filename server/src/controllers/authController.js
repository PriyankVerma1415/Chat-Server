const crypto = require('crypto');
const User = require('../models/User');
const Otp = require('../models/Otp');
const jwt = require('jsonwebtoken');
const resend = require('../config/resend');

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
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const sendOtp = async (req, res) => {
  try {
    const { email, fullName } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Generate 6-digit OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();

    // Delete any existing OTPs for this email to prevent spam conflicts
    await Otp.deleteMany({ email });

    // Save new OTP to database (will be hashed by pre-save hook)
    await Otp.create({ email, otp: otpCode });

    // Prepare HTML Email Template
    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; padding: 40px; border-radius: 12px; text-align: center;">
        <img src="${process.env.CLIENT_URL}/nexchat-logo.png" alt="NexChat" width="64" height="64" style="border-radius: 16px; margin-bottom: 10px; display: inline-block;" />
        <h1 style="color: #38bdf8; margin-bottom: 10px; margin-top: 0;">NexChat</h1>
        <p style="font-size: 16px; color: #cbd5e1; margin-bottom: 30px;">Hello${fullName ? ` ${fullName}` : ''}, use the following security code to access your account.</p>
        <div style="background-color: #1e293b; border: 1px solid #334155; padding: 20px; border-radius: 8px; margin-bottom: 30px; box-shadow: 0 0 15px rgba(56, 189, 248, 0.1);">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #38bdf8;">${otpCode}</span>
        </div>
        <p style="font-size: 14px; color: #94a3b8; margin-bottom: 10px;">This code will expire in exactly <strong>5 minutes</strong>.</p>
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #334155;">
          <p style="font-size: 12px; color: #475569;">© 2026 NexChat. All rights reserved.</p>
        </div>
      </div>
      <div style="display: none; white-space: nowrap; font: 15px/0px courier; color: transparent;">
        - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
      </div>
      <div style="display: none; visibility: hidden; color: transparent; font-size: 1px;">
        Unique Request ID: ${Date.now()}-${crypto.randomBytes(4).toString('hex')}
      </div>
    `;

    // Send email using Resend
    const { data, error } = await resend.emails.send({
      from: 'NexChat Security <onboarding@resend.dev>',
      to: email,
      subject: 'Your NexChat Verification Code',
      html: htmlTemplate,
    });

    if (error) {
      console.error('Resend Error:', error);
      return res.status(400).json({ message: error.message || 'Failed to send OTP email' });
    }

    res.status(200).json({ message: 'OTP sent successfully', success: true });
  } catch (error) {
    console.error('Send OTP Error:', error);
    res.status(500).json({ message: 'Internal Server Error while sending OTP' });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { email, otp, fullName } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    // Find the latest OTP document for this email
    const otpRecord = await Otp.findOne({ email }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({ message: 'OTP is invalid or has expired' });
    }

    // Verify OTP using schema method (bcrypt compare)
    const isValid = await otpRecord.verifyOtp(otp);

    if (!isValid) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // OTP is valid! Delete it immediately.
    await Otp.deleteMany({ email });

    // Upsert User
    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        email,
        username: fullName || '',
        authProvider: 'resend',
        loginMethod: 'email_otp',
        lastLogin: Date.now(),
      });
    } else {
      user.lastLogin = Date.now();
      user.authProvider = 'resend';
      user.loginMethod = 'email_otp';
      if (fullName && !user.username) {
        user.username = fullName;
      }
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id, user.tokenVersion);

    user.refreshToken = refreshToken;
    await user.save();

    setTokenCookie(res, refreshToken);

    res.json({
      success: true,
      _id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      bio: user.bio,
      profileCompleted: user.profileCompleted,
      token: accessToken,
    });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(500).json({ message: 'Internal Server Error during verification' });
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

    if (!user || user.tokenVersion !== decoded.tokenVersion) {
      return res.status(401).json({ message: 'Not authorized, token invalid or revoked' });
    }

    const newAccessToken = generateAccessToken(user._id);
    res.json({ token: newAccessToken });
  } catch (error) {
    res.status(401).json({ message: 'Not authorized, refresh token failed' });
  }
};

const logoutUser = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (token) {
      const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
      const user = await User.findById(decoded.id);
      
      if (user) {
        user.tokenVersion += 1;
        await user.save();
      }
    }
  } catch (error) {
    // Ignore verification errors on logout
  }

  res.cookie('refreshToken', '', {
    httpOnly: true,
    expires: new Date(0),
  });

  res.status(200).json({ message: 'Logged out successfully' });
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-refreshToken -tokenVersion -contacts -blockedUsers');
    
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { sendOtp, verifyOtp, refreshAuthToken, logoutUser, getMe };
