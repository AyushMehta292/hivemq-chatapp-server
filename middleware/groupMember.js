import mongoose from 'mongoose';
import Group from '../models/Group.js';

export const requireGroupMember = async (req, res, next) => {
  try {
    const groupId = req.params.groupId || req.body?.groupId;
    if (!groupId) {
      return res.status(400).json({ message: 'Group ID required' });
    }
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    const userId = req.user._id.toString();
    const isMember = group.createdBy.toString() === userId ||
      group.memberIds.some((id) => id.toString() === userId);
    if (!isMember) {
      return res.status(403).json({ message: 'Not a member of this group' });
    }
    req.group = group;
    next();
  } catch (err) {
    res.status(500).json({ message: err.message || 'Authorization failed' });
  }
};

export const requireGroupAdmin = async (req, res, next) => {
  try {
    const groupId = req.params.groupId || req.body?.groupId;
    if (!groupId) {
      return res.status(400).json({ message: 'Group ID required' });
    }
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    const userId = req.user._id.toString();
    if (group.createdBy.toString() !== userId) {
      return res.status(403).json({ message: 'Only the group creator can do this' });
    }
    req.group = group;
    next();
  } catch (err) {
    res.status(500).json({ message: err.message || 'Authorization failed' });
  }
};
