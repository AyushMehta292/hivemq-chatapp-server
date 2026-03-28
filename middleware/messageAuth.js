import mongoose from 'mongoose';
import Message from '../models/Message.js';

export const EDIT_DELETE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export const requireMessageSenderAndWithinWindow = async (req, res, next) => {
  try {
    const messageId = req.params.messageId;
    if (!messageId) {
      return res.status(400).json({ message: 'Message ID required' });
    }
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ message: 'Invalid message ID' });
    }
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    const userId = req.user._id.toString();
    const senderId = message.senderId.toString();
    if (senderId !== userId) {
      return res.status(403).json({ message: 'Only the sender can edit or delete this message' });
    }
    const age = Date.now() - new Date(message.createdAt).getTime();
    if (age > EDIT_DELETE_WINDOW_MS) {
      return res.status(403).json({ message: 'Edit and delete are only allowed within 10 minutes of sending' });
    }
    req.message = message;
    next();
  } catch (err) {
    res.status(500).json({ message: err.message || 'Authorization failed' });
  }
};
