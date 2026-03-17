import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { getMe, searchUsers } from '../controllers/userController.js';

const router = express.Router();
router.use(authenticate);

router.get('/me', getMe);
router.get('/search', searchUsers);

export default router;
