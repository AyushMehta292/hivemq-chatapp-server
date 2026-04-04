import multer from 'multer';

export const LIMITS = {
  image: 5 * 1024 * 1024,   // 5MB
  video: 20 * 1024 * 1024,  // 20MB
  other: 50 * 1024 * 1024,  // 50MB
};

const imageTypes = /^image\//;
const videoTypes = /^video\//;

const memoryStorage = multer.memoryStorage();

export const uploadGeneric = multer({
  storage: memoryStorage,
  limits: { fileSize: LIMITS.other },
  fileFilter: (req, file, cb) => {
    const type = (req.body?.type || req.query?.type || 'other').toLowerCase();
    if (type === 'image' && !imageTypes.test(file.mimetype)) {
      return cb(new Error('Only images allowed for type image'));
    }
    if (type === 'video' && !videoTypes.test(file.mimetype)) {
      return cb(new Error('Only videos allowed for type video'));
    }
    cb(null, true);
  },
}).single('file');

export const uploadProfilePic = multer({
  storage: memoryStorage,
  limits: { fileSize: LIMITS.image },
  fileFilter: (req, file, cb) => {
    if (!imageTypes.test(file.mimetype)) {
      return cb(new Error('Only images allowed for profile picture'));
    }
    cb(null, true);
  },
}).single('file');
