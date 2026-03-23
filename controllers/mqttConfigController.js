import Group from '../models/Group.js';

const DEFAULT_HOST = 'bf88379b1d754c5f9e53b81f7b1b4aa6.s1.eu.hivemq.cloud';

function normalizeMqttUrl(value) {
  if (!value || typeof value !== 'string') return `wss://${DEFAULT_HOST}:8884/mqtt`;
  const v = value.trim();
  if (v.startsWith('wss://') || v.startsWith('ws://')) {
    if (v.includes(':8884')) return v;
    const host = v.replace(/^wss?:\/\//, '').split('/')[0].split(':')[0];
    return `wss://${host}:8884/mqtt`;
  }
  const host = v.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
  return `wss://${host}:8884/mqtt`;
}

export const getMQTTConfig = async (req, res) => {
  try {
    const userId = req.user._id;
    const groups = await Group.find({
      $or: [
        { createdBy: userId },
        { memberIds: userId },
      ],
    })
      .select('_id')
      .lean();
    const topics = groups.map((g) => `chat/group/${g._id}`);
    res.json({
      url: normalizeMqttUrl(process.env.HIVEMQ_WS_URL),
      username: process.env.HIVEMQ_USER,
      password: process.env.HIVEMQ_PASSWORD,
      topics,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to get MQTT config' });
  }
};
