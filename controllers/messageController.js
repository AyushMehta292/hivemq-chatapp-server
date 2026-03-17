import Message from '../models/Message.js';
import { publishToGroup } from '../services/mqttService.js';

function normalizeAttachments(attachments) {
  if (!attachments) return [];
  if (typeof attachments === 'string') {
    try {
      attachments = JSON.parse(attachments);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(attachments)) return [];
  const out = [];
  for (const a of attachments) {
    if (typeof a === 'string') {
      try {
        const parsed = JSON.parse(a);
        if (parsed && typeof parsed === 'object' && parsed.url) {
          out.push({
            url: String(parsed.url),
            type: parsed.type ? String(parsed.type) : 'other',
            publicId: parsed.publicId ? String(parsed.publicId) : undefined,
            filename: parsed.filename ? String(parsed.filename) : undefined,
          });
        }
      } catch {
        // skip invalid string element
      }
      continue;
    }
    if (a && typeof a === 'object' && a.url) {
      out.push({
        url: String(a.url),
        type: a.type ? String(a.type) : 'other',
        publicId: a.publicId ? String(a.publicId) : undefined,
        filename: a.filename ? String(a.filename) : undefined,
      });
    }
  }
  return out;
}

export const sendMessage = async (req, res) => {
  try {
    const { groupId, content, attachments: rawAttachments } = req.body;
    const group = req.group;
    const attachments = normalizeAttachments(rawAttachments);
    const message = await Message.create({
      groupId: group._id,
      senderId: req.user._id,
      content: content?.trim() || '',
      attachments,
    });
    const populated = await Message.findById(message._id)
      .populate('senderId', 'username email profilePic')
      .lean();
    const payload = {
      _id: populated._id,
      groupId: String(groupId),
      senderId: populated.senderId,
      content: populated.content,
      attachments: populated.attachments,
      createdAt: populated.createdAt,
    };
    publishToGroup(groupId, payload);
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to send message' });
  }
};

export const getMessages = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const messages = await Message.find({ groupId })
      .populate('senderId', 'username email profilePic')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    const total = await Message.countDocuments({ groupId });
    res.json({
      messages: messages.reverse(),
      pagination: { page, limit, total },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch messages' });
  }
};

export const updateMessage = async (req, res) => {
  try {
    const message = req.message;
    const content = req.body.content;
    if (content !== undefined) {
      message.content = (typeof content === 'string' ? content : '').trim();
    }
    await message.save();
    const populated = await Message.findById(message._id)
      .populate('senderId', 'username email profilePic')
      .lean();
    const payload = {
      _id: populated._id,
      groupId: String(populated.groupId),
      senderId: populated.senderId,
      content: populated.content,
      attachments: populated.attachments,
      createdAt: populated.createdAt,
      updatedAt: populated.updatedAt,
    };
    publishToGroup(populated.groupId, payload);
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to update message' });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const message = req.message;
    const messageId = message._id.toString();
    const groupId = message.groupId.toString();
    await Message.findByIdAndDelete(message._id);
    publishToGroup(groupId, { action: 'deleted', messageId, groupId });
    res.json({ deleted: true, messageId });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to delete message' });
  }
};
