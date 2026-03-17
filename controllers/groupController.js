import mongoose from 'mongoose';
import Group from '../models/Group.js';
import User from '../models/User.js';

export const createGroup = async (req, res) => {
  try {
    const { name, memberIds } = req.body;
    const userId = req.user._id;
    const allMembers = [...new Set([userId.toString(), ...(memberIds || []).map(String)])];
    const group = await Group.create({
      name: name?.trim() || 'New Group',
      createdBy: userId,
      memberIds: allMembers,
      isDirect: false,
    });
    const populated = await Group.findById(group._id)
      .populate('createdBy', 'username email profilePic')
      .populate('memberIds', 'username email profilePic')
      .lean();
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to create group' });
  }
};

export const getMyGroups = async (req, res) => {
  try {
    const userId = req.user._id;
    const groups = await Group.find({
      $or: [
        { createdBy: userId },
        { memberIds: userId },
      ],
    })
      .populate('createdBy', 'username email profilePic')
      .populate('memberIds', 'username email profilePic')
      .sort({ updatedAt: -1 })
      .lean();
    res.json(groups);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch groups' });
  }
};

export const getOrCreateDirectGroup = async (req, res) => {
  try {
    const otherUserId = req.body?.otherUserId || req.query?.otherUserId;
    if (!otherUserId || !mongoose.Types.ObjectId.isValid(otherUserId)) {
      return res.status(400).json({ message: 'Valid otherUserId required' });
    }
    const userId = req.user._id;
    const otherIdStr = otherUserId.toString();
    const userIdStr = userId.toString();
    if (otherIdStr === userIdStr) {
      return res.status(400).json({ message: 'Cannot start a chat with yourself' });
    }
    const otherUser = await User.findById(otherUserId).select('username isEmailVerified').lean();
    if (!otherUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (!otherUser.isEmailVerified) {
      return res.status(400).json({ message: 'That user has not verified their email' });
    }
    const existing = await Group.findOne({
      isDirect: true,
      memberIds: { $all: [userId, otherUserId], $size: 2 },
    })
      .populate('createdBy', 'username email profilePic')
      .populate('memberIds', 'username email profilePic')
      .lean();
    if (existing) {
      return res.json(existing);
    }
    const group = await Group.create({
      name: 'Direct',
      createdBy: userId,
      memberIds: [userId, otherUserId],
      isDirect: true,
    });
    const populated = await Group.findById(group._id)
      .populate('createdBy', 'username email profilePic')
      .populate('memberIds', 'username email profilePic')
      .lean();
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to get or create direct chat' });
  }
};

export const getOrCreateSelfGroup = async (req, res) => {
  try {
    const userId = req.user._id;
    const existing = await Group.findOne({
      isSelf: true,
      createdBy: userId,
    })
      .populate('createdBy', 'username email profilePic')
      .populate('memberIds', 'username email profilePic')
      .lean();
    if (existing) {
      return res.json(existing);
    }
    const group = await Group.create({
      name: 'Saved',
      createdBy: userId,
      memberIds: [userId],
      isSelf: true,
    });
    const populated = await Group.findById(group._id)
      .populate('createdBy', 'username email profilePic')
      .populate('memberIds', 'username email profilePic')
      .lean();
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to get or create self chat' });
  }
};

export const getGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId)
      .populate('createdBy', 'username email profilePic')
      .populate('memberIds', 'username email profilePic')
      .lean();
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    const userId = req.user._id.toString();
    const isMember = group.createdBy._id.toString() === userId ||
      group.memberIds.some((m) => m._id.toString() === userId);
    if (!isMember) {
      return res.status(403).json({ message: 'Not a member of this group' });
    }
    res.json(group);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch group' });
  }
};

export const updateGroup = async (req, res) => {
  try {
    const { name, memberIds } = req.body;
    const group = req.group;
    if (!name && !memberIds) {
      return res.status(400).json({ message: 'Provide name and/or memberIds' });
    }
    if (name !== undefined) {
      const trimmed = (typeof name === 'string' ? name : '').trim();
      if (trimmed.length === 0) {
        return res.status(400).json({ message: 'Group name cannot be empty' });
      }
      if (trimmed.length > 100) {
        return res.status(400).json({ message: 'Group name must be at most 100 characters' });
      }
      group.name = trimmed;
    }
    if (memberIds !== undefined) {
      if (!Array.isArray(memberIds)) {
        return res.status(400).json({ message: 'memberIds must be an array' });
      }
      const creatorId = group.createdBy.toString();
      const validIds = memberIds
        .map((id) => (id && id.toString ? id.toString() : String(id)))
        .filter((id) => id && mongoose.Types.ObjectId.isValid(id));
      const uniqueIds = [...new Set(validIds)];
      if (!uniqueIds.includes(creatorId)) {
        uniqueIds.unshift(creatorId);
      }
      group.memberIds = uniqueIds.map((id) => new mongoose.Types.ObjectId(id));
    }
    await group.save();
    const populated = await Group.findById(group._id)
      .populate('createdBy', 'username email profilePic')
      .populate('memberIds', 'username email profilePic')
      .lean();
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to update group' });
  }
};

export const leaveGroup = async (req, res) => {
  try {
    const group = req.group;
    const userId = req.user._id;
    const userIdStr = userId.toString();
    const newMemberIds = group.memberIds
      .filter((id) => id.toString() !== userIdStr)
      .map((id) => id);
    const wasCreator = group.createdBy.toString() === userIdStr;
    if (newMemberIds.length === 0) {
      await Group.findByIdAndDelete(group._id);
      return res.json({ left: true, group: null });
    }
    if (wasCreator) {
      group.createdBy = newMemberIds[0];
    }
    group.memberIds = newMemberIds;
    await group.save();
    const populated = await Group.findById(group._id)
      .populate('createdBy', 'username email profilePic')
      .populate('memberIds', 'username email profilePic')
      .lean();
    res.json({ left: true, group: populated });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to leave group' });
  }
};
