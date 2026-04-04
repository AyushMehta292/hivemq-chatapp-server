import User from '../models/User.js';
import cloudinary from '../config/cloudinary.js';

export const updateProfilePic = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const user = req.user;
    let oldPublicId = null;
    if (user.profilePic) {
      const match = user.profilePic.match(/\/v\d+\/(.+)\.\w+$/);
      if (match) oldPublicId = match[1].replace(/\//g, ':');
    }
    return new Promise((resolve) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'chat/profile-pics' },
        async (err, result) => {
          if (err) {
            return resolve(res.status(500).json({ message: err.message || 'Upload failed' }));
          }
          await User.findByIdAndUpdate(user._id, { profilePic: result.secure_url });
          if (oldPublicId) {
            cloudinary.uploader.destroy(oldPublicId).catch(() => {});
          }
          const updated = await User.findById(user._id).select('-password').lean();
          resolve(res.json(updated));
        }
      );
      uploadStream.end(req.file.buffer);
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Update failed' });
  }
};

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
