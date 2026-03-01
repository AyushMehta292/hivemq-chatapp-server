import crypto from 'crypto';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import OTPModel from '../models/OTP.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { sendOTPEmail, sendPasswordResetEmail } from '../services/emailService.js';

const COOKIE_EXPIRE_DAYS = Number(process.env.COOKIE_EXPIRE) || 5;

const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_EXPIRE_DAYS * 24 * 60 * 60 * 1000,
  });
};

export const register = async (req, res) => {
  console.log('[Register] Request received', req.body?.email || '(no email)');
  try {
    const { email, username, password } = req.body;
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    const existingUsername = await User.findOne({ username: username.trim() });
    if (existingUsername) {
      return res.status(400).json({ message: 'Username already taken' });
    }
    const user = await User.create({
      email: email.toLowerCase().trim(),
      username: username.trim(),
      password,
      isEmailVerified: false,
    });
    const otp = crypto.randomInt(100000, 999999).toString();
    await OTPModel.create({
      email: user.email,
      otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Register] Dev OTP for', user.email, '->', otp);
    }
    try {
      await sendOTPEmail(user.email, otp);
    } catch (emailErr) {
      console.error('[Register] OTP email failed:', emailErr.message);
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Register] Use OTP above to verify:', otp);
      }
      return res.status(500).json({
        message: 'Registration saved but we could not send the OTP email. Check SMTP settings and server logs.',
        email: user.email,
        debug: process.env.NODE_ENV !== 'production' ? emailErr.message : undefined,
      });
    }
    res.status(201).json({
      message: 'Registration successful. Check your email for the OTP.',
      email: user.email,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Registration failed' });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const record = await OTPModel.findOne({
      email: email.toLowerCase().trim(),
      otp,
      purpose: 'email_verify',
    });
    if (!record) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    if (new Date() > record.expiresAt) {
      await OTPModel.deleteOne({ _id: record._id });
      return res.status(400).json({ message: 'OTP expired' });
    }
    const user = await User.findOneAndUpdate(
      { email: record.email },
      { isEmailVerified: true },
      { new: true }
    ).select('-password');
    await OTPModel.deleteOne({ _id: record._id });
    const accessToken = signAccessToken({ userId: user._id, email: user.email });
    const refreshToken = signRefreshToken({ userId: user._id });
    await RefreshToken.create({
      userId: user._id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      userAgent: req.headers['user-agent'],
    });
    setRefreshCookie(res, refreshToken);
    res.json({
      message: 'Email verified',
      user,
      accessToken,
      refreshToken,
      expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Verification failed' });
  }
};

export const login = async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;
    const isEmail = emailOrUsername?.includes('@');
    const user = await User.findOne(
      isEmail ? { email: emailOrUsername.toLowerCase().trim() } : { username: emailOrUsername?.trim() }
    ).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (!user.isEmailVerified) {
      return res.status(403).json({ message: 'Please verify your email first' });
    }
    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const accessToken = signAccessToken({ userId: user._id, email: user.email });
    const refreshToken = signRefreshToken({ userId: user._id });
    await RefreshToken.create({
      userId: user._id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      userAgent: req.headers['user-agent'],
    });
    setRefreshCookie(res, refreshToken);
    const userObj = user.toObject();
    delete userObj.password;
    res.json({
      user: userObj,
      accessToken,
      refreshToken,
      expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Login failed' });
  }
};

export const refresh = async (req, res) => {
  try {
    const token = req.body.refreshToken || req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ message: 'Refresh token required' });
    }
    const decoded = verifyRefreshToken(token);
    const stored = await RefreshToken.findOne({ token });
    if (!stored) {
      return res.status(401).json({ message: 'Refresh token invalid or revoked' });
    }
    const user = await User.findById(decoded.userId).select('email').lean();
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    const newAccessToken = signAccessToken({ userId: decoded.userId, email: user.email });
    res.json({
      accessToken: newAccessToken,
      expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
    });
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
};

export const logout = async (req, res) => {
  try {
    const token = req.body.refreshToken || req.cookies?.refreshToken;
    if (token) {
      await RefreshToken.deleteOne({ token });
    }
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Logout failed' });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !user.isEmailVerified) {
      return res.json({ message: 'If an account exists, we sent a reset code to your email.' });
    }
    await OTPModel.deleteMany({ email: user.email, purpose: 'password_reset' });
    const otp = crypto.randomInt(100000, 999999).toString();
    await OTPModel.create({
      email: user.email,
      otp,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      purpose: 'password_reset',
    });
    if (process.env.NODE_ENV !== 'production') {
      console.log('[ForgotPassword] Reset OTP for', user.email, '->', otp);
    }
    try {
      await sendPasswordResetEmail(user.email, otp);
    } catch (emailErr) {
      console.error('[ForgotPassword] Email failed:', emailErr.message);
      return res.status(500).json({
        message: 'We could not send the reset code. Please try again later.',
      });
    }
    res.json({ message: 'If an account exists, we sent a reset code to your email.' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Request failed' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const record = await OTPModel.findOne({
      email: email.toLowerCase().trim(),
      otp,
      purpose: 'password_reset',
    });
    if (!record) {
      return res.status(400).json({ message: 'Invalid or expired reset code' });
    }
    if (new Date() > record.expiresAt) {
      await OTPModel.deleteOne({ _id: record._id });
      return res.status(400).json({ message: 'Reset code expired' });
    }
    const user = await User.findOne({ email: record.email }).select('+password');
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }
    user.password = newPassword;
    await user.save();
    await OTPModel.deleteOne({ _id: record._id });
    res.json({ message: 'Password updated. You can sign in now.' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Reset failed' });
  }
};
