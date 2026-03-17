import User from '../models/User.js';

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password').lean();
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to get user' });
  }
};

export const searchUsers = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) {
      return res.json([]);
    }
    const currentId = req.user._id;
    const users = await User.find({
      _id: { $ne: currentId },
      isEmailVerified: true,
      $or: [
        { username: new RegExp(q, 'i') },
        { email: new RegExp(q, 'i') },
      ],
    })
      .select('_id username email profilePic')
      .limit(10)
      .lean();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Search failed' });
  }
};
