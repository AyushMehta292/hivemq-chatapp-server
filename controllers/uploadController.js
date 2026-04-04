import cloudinary from '../config/cloudinary.js';
import { LIMITS } from '../middleware/upload.js';

export const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const type = (req.body?.type || 'other').toLowerCase();
    const limit = LIMITS[type] || LIMITS.other;
    if (req.file.size > limit) {
      return res.status(400).json({
        message: `File too large. Max for ${type}: ${limit / (1024 * 1024)}MB`,
      });
    }
    const folder = type === 'image' ? 'chat/images' : type === 'video' ? 'chat/videos' : 'chat/files';
    const resourceType = type === 'video' ? 'video' : type === 'other' ? 'raw' : 'image';

    if (type === 'other') {
      const mimetype = req.file.mimetype || 'application/octet-stream';
      const dataUri = `data:${mimetype};base64,${req.file.buffer.toString('base64')}`;
      return new Promise((resolve) => {
        cloudinary.uploader.upload(
          dataUri,
          {
            folder,
            resource_type: 'raw',
          },
          (err, result) => {
            if (err) {
              return resolve(res.status(500).json({ message: err.message || 'Upload failed' }));
            }
            resolve(res.json({
              url: result.secure_url,
              publicId: result.public_id,
              type: 'other',
              filename: req.file.originalname || req.file.name || undefined,
            }));
          }
        );
      });
    }

    return new Promise((resolve) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: resourceType,
        },
        (err, result) => {
          if (err) {
            return resolve(res.status(500).json({ message: err.message || 'Upload failed' }));
          }
          resolve(res.json({
            url: result.secure_url,
            publicId: result.public_id,
            type,
            filename: req.file.originalname || req.file.name || undefined,
          }));
        }
      );
      uploadStream.end(req.file.buffer);
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Upload failed' });
  }
};
