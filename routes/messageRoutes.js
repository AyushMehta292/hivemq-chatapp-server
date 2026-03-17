import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireGroupMember } from '../middleware/groupMember.js';
import { requireMessageSenderAndWithinWindow } from '../middleware/messageAuth.js';
import { sendMessage, getMessages, updateMessage, deleteMessage } from '../controllers/messageController.js';

const router = express.Router();
router.use(authenticate);

router.post('/', requireGroupMember, sendMessage);
router.get('/:groupId', requireGroupMember, getMessages);
router.patch('/:messageId', requireMessageSenderAndWithinWindow, updateMessage);
router.delete('/:messageId', requireMessageSenderAndWithinWindow, deleteMessage);

export default router;
