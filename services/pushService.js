import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';

let configured = false;

export function initPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:support@example.com';
  if (!publicKey || !privateKey) {
    console.warn('[Push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set — web push disabled');
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  console.log('[Push] Web push ready');
  return true;
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

function groupMemberIds(group, excludeUserId = null) {
  const ids = new Set();
  if (group.createdBy) ids.add(String(group.createdBy._id || group.createdBy));
  for (const m of group.memberIds || []) {
    ids.add(String(m._id || m));
  }
  if (excludeUserId) ids.delete(String(excludeUserId));
  return [...ids];
}

function directDisplayName(group, viewerId) {
  if (group.isSelf) return 'Saved';
  if (group.isDirect && group.memberIds?.length === 2) {
    const other = group.memberIds.find((m) => String(m._id || m) !== String(viewerId));
    if (other?.username) return other.username;
  }
  return group.name || 'Chat';
}

function ensurePushReady() {
  if (!configured) initPush();
  return configured;
}

async function sendPushToUserIds(userIds, notification) {
  if (!ensurePushReady() || !userIds?.length) return;
  const subs = await PushSubscription.find({ userId: { $in: userIds } }).lean();
  if (!subs.length) return;

  const payload = JSON.stringify(notification);
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          payload
        );
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await PushSubscription.deleteOne({ _id: sub._id });
        }
      }
    })
  );
}

export async function notifyGroupMessage({ group, message, senderId, preview }) {
  const recipientIds = groupMemberIds(group, senderId);
  if (!recipientIds.length) return;

  const senderName = message.senderId?.username || 'Someone';
  const frontend = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  const groupId = String(group._id);

  await Promise.all(
    recipientIds.map((uid) => {
      const title = directDisplayName(group, uid);
      return sendPushToUserIds([uid], {
        title,
        body: `${senderName}: ${preview || 'New message'}`,
        tag: `msg-${groupId}`,
        data: {
          type: 'message',
          groupId,
          url: `${frontend}/chat/${groupId}`,
        },
      });
    })
  );
}

export async function notifyGroupCall({ group, initiatorId, initiatorName, callId }) {
  const recipientIds = groupMemberIds(group, initiatorId);
  if (!recipientIds.length) return;

  const frontend = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  const groupId = String(group._id);
  const caller = initiatorName || 'Someone';

  await Promise.all(
    recipientIds.map((uid) => {
      const title = directDisplayName(group, uid);
      return sendPushToUserIds([uid], {
        title: `Incoming call — ${title}`,
        body: `${caller} is calling`,
        tag: `call-${callId}`,
        requireInteraction: true,
        vibrate: [300, 100, 300, 100, 300],
        data: {
          type: 'call',
          groupId,
          callId: String(callId),
          url: `${frontend}/chat/${groupId}?call=${callId}`,
        },
      });
    })
  );
}
