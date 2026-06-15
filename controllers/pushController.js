import PushSubscription from '../models/PushSubscription.js';
import { getVapidPublicKey, initPush } from '../services/pushService.js';

export const getVapidKey = (req, res) => {
  initPush();
  const key = getVapidPublicKey();
  if (!key) {
    return res.status(503).json({ message: 'Push notifications are not configured on this server' });
  }
  res.json({ publicKey: key });
};

export const subscribePush = async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ message: 'Invalid push subscription' });
    }
    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        userId: req.user._id,
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
        userAgent: req.headers['user-agent'] || '',
      },
      { upsert: true, new: true }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to save subscription' });
  }
};

export const unsubscribePush = async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ message: 'endpoint required' });
    }
    await PushSubscription.deleteOne({ endpoint, userId: req.user._id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to unsubscribe' });
  }
};
