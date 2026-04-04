import Group from '../models/Group.js';
import cloudinary from '../config/cloudinary.js';

export const updateGroupProfilePic = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const group = req.group;
    let oldPublicId = null;
    if (group.profilePic) {
      const match = group.profilePic.match(/\/v\d+\/(.+)\.\w+$/);
      if (match) oldPublicId = match[1].replace(/\//g, ':');
    }
    return new Promise((resolve) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'chat/group-pics' },
        async (err, result) => {
          if (err) {
            return resolve(res.status(500).json({ message: err.message || 'Upload failed' }));
          }
          const updated = await Group.findByIdAndUpdate(
            group._id,
            { profilePic: result.secure_url },
            { new: true }
          )
            .populate('createdBy', 'username email profilePic')
            .populate('memberIds', 'username email profilePic')
            .lean();
          if (oldPublicId) {
            cloudinary.uploader.destroy(oldPublicId).catch(() => {});
          }
          resolve(res.json(updated));
        }
      );
      uploadStream.end(req.file.buffer);
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Update failed' });
  }
};
