import mongoose from 'mongoose';

const callSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
      index: true,
    },
    livekitRoomName: {
      type: String,
      required: true,
      trim: true,
    },
    initiatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['ringing', 'active', 'ended'],
      default: 'ringing',
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

callSchema.index({ groupId: 1, status: 1 });

export default mongoose.model('Call', callSchema);
