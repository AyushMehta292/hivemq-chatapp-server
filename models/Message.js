import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    type: { type: String, default: 'other' },
    publicId: String,
    filename: String,
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  content: {
    type: String,
    default: '',
    trim: true,
  },
  attachments: {
    type: [attachmentSchema],
    default: [],
  },
}, {
  timestamps: true,
});

messageSchema.index({ groupId: 1, createdAt: -1 });

export default mongoose.model('Message', messageSchema);
