import User from '../models/User.js';
import { signAccessToken } from '../utils/jwt.js';

export const register = async (req, res) => {
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
      isEmailVerified: true,
    });
    const userObj = user.toObject();
    delete userObj.password;
    const accessToken = signAccessToken({ userId: user._id, email: user.email });
    res.status(201).json({
      message: 'Registration successful',
      user: userObj,
      accessToken,
      expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Registration failed' });
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
    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const accessToken = signAccessToken({ userId: user._id, email: user.email });
    const userObj = user.toObject();
    delete userObj.password;
    res.json({
      user: userObj,
      accessToken,
      expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Login failed' });
  }
};
