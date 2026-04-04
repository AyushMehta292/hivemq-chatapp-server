import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { uploadProfilePic } from '../middleware/upload.js';
import { getMe, updateProfilePic, searchUsers } from '../controllers/userController.js';

const router = express.Router();
router.use(authenticate);

router.get('/me', getMe);
router.get('/search', searchUsers);
router.patch('/me/profile-pic', uploadProfilePic, updateProfilePic);

export default router;
