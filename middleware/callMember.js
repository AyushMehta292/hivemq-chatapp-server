import mongoose from 'mongoose';
import Group from '../models/Group.js';
import Call from '../models/Call.js';

export const requireCallParticipant = async (req, res, next) => {
  try {
    const { callId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(callId)) {
      return res.status(400).json({ message: 'Invalid call ID' });
    }
    const call = await Call.findById(callId);
    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }
    if (call.status === 'ended') {
      return res.status(410).json({ message: 'Call has ended' });
    }
    if (new Date() > call.expiresAt) {
      await Call.updateOne({ _id: call._id }, { status: 'ended' });
      return res.status(410).json({ message: 'Call expired' });
    }
    const group = await Group.findById(call.groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    const userId = req.user._id.toString();
    const isMember =
      group.createdBy.toString() === userId ||
      group.memberIds.some((id) => id.toString() === userId);
    if (!isMember) {
      return res.status(403).json({ message: 'Not allowed' });
    }
    req.call = call;
    req.groupForCall = group;
    next();
  } catch (err) {
    res.status(500).json({ message: err.message || 'Authorization failed' });
  }
};
