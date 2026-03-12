import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  memberIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  profilePic: {
    type: String,
    default: null,
  },
  isDirect: {
    type: Boolean,
    default: false,
  },
  isSelf: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

export default mongoose.model('Group', groupSchema);
