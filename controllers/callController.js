import mongoose from 'mongoose';
import Call from '../models/Call.js';
import User from '../models/User.js';
import { publishCallSignal } from '../services/mqttService.js';
import { getLiveKitWsUrl, mintParticipantToken, countParticipantsInRoom } from '../services/livekitService.js';

/** Room/token validity — ring + connected time (tokens use 2h TTL on LiveKit side). */
const CALL_SESSION_MS = 2 * 60 * 60 * 1000;

function uniqueMemberCount(group) {
  const ids = new Set();
  ids.add(group.createdBy.toString());
  for (const id of group.memberIds || []) {
    ids.add(id.toString());
  }
  return ids.size;
}

async function findLiveCallForGroup(groupObjectId) {
  return Call.findOne({
    groupId: groupObjectId,
    status: { $in: ['ringing', 'active'] },
    expiresAt: { $gt: new Date() },
  })
    .select('_id livekitRoomName initiatorId status createdAt')
    .lean();
}

/** Grace so we never treat “room warming up” as empty before anyone connects. */
const EMPTY_ROOM_MIN_CALL_AGE_MS = 12_000;

/**
 * If LiveKit shows zero participants, mark the call ended and notify via MQTT.
 * @param {{ _id: unknown, livekitRoomName: string, groupId: unknown }} callLean
 * @param {{ minAgeMs?: number|null }} [opts] pass null/omit minAgeMs for leave-handler (no grace)
 */
async function finalizeCallIfLiveKitRoomEmpty(callLean, opts = {}) {
  const minAgeMs = opts.minAgeMs !== undefined ? opts.minAgeMs : EMPTY_ROOM_MIN_CALL_AGE_MS;
  const fresh = await Call.findById(callLean._id)
    .select('_id livekitRoomName groupId status createdAt')
    .lean();
  if (!fresh || fresh.status === 'ended') return false;
  if (fresh.status === 'ringing') return false;
  if (minAgeMs != null && minAgeMs > 0 && fresh.createdAt) {
    const age = Date.now() - new Date(fresh.createdAt).getTime();
    if (age < minAgeMs) return false;
  }
  const count = await countParticipantsInRoom(fresh.livekitRoomName);
  if (count === null) return false;
  if (count > 0) return false;
  const r = await Call.updateOne({ _id: fresh._id, status: { $in: ['ringing', 'active'] } }, { $set: { status: 'ended' } });
  if (r.modifiedCount === 0) return false;
  publishCallSignal(fresh.groupId.toString(), {
    kind: 'call_ended',
    callId: fresh._id.toString(),
    groupId: fresh.groupId.toString(),
    endedBy: 'system',
  });
  return true;
}

/** GET /calls/active/:groupId — who declined / left UI can still join via token */
export const getActiveCallForGroup = async (req, res) => {
  try {
    const group = req.group;
    let call = await findLiveCallForGroup(group._id);
    if (!call) {
      return res.json({ call: null });
    }
    if (await finalizeCallIfLiveKitRoomEmpty(call)) {
      return res.json({ call: null });
    }
    call = await findLiveCallForGroup(group._id);
    if (!call) {
      return res.json({ call: null });
    }
    res.json({
      call: {
        callId: call._id.toString(),
        roomName: call.livekitRoomName,
        initiatorId: call.initiatorId.toString(),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed' });
  }
};

export const startCall = async (req, res) => {
  try {
    const group = req.group;
    if (group.isSelf) {
      return res.status(400).json({ message: 'Voice/video calls are not available in Saved chat.' });
    }
    const n = uniqueMemberCount(group);
    if (n < 2 || n > 10) {
      return res.status(400).json({ message: 'Calls require between 2 and 10 people in this chat.' });
    }

    let existing = await findLiveCallForGroup(group._id);
    if (existing) {
      await finalizeCallIfLiveKitRoomEmpty(existing);
      existing = await findLiveCallForGroup(group._id);
    }
    if (existing) {
      return res.status(409).json({
        message: 'A call is already active in this chat. Join it instead.',
        callId: existing._id.toString(),
        roomName: existing.livekitRoomName,
        initiatorId: existing.initiatorId.toString(),
      });
    }

    const callId = new mongoose.Types.ObjectId();
    const livekitRoomName = `call_${callId.toString()}`;
    const expiresAt = new Date(Date.now() + CALL_SESSION_MS);

    let url;
    let jwt;
    try {
      url = getLiveKitWsUrl();
      const me = await User.findById(req.user._id).select('username').lean();
      jwt = await mintParticipantToken({
        identity: req.user._id.toString(),
        name: me?.username,
        roomName: livekitRoomName,
      });
    } catch (err) {
      return res.status(503).json({
        message: err.message || 'LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET.',
      });
    }

    await Call.create({
      _id: callId,
      groupId: group._id,
      livekitRoomName,
      initiatorId: req.user._id,
      status: 'active',
      expiresAt,
    });

    const initiator = await User.findById(req.user._id).select('username').lean();
    publishCallSignal(group._id.toString(), {
      kind: 'call_invite',
      callId: callId.toString(),
      roomName: livekitRoomName,
      groupId: group._id.toString(),
      groupName: group.name,
      initiatorId: req.user._id.toString(),
      initiatorName: initiator?.username || 'Someone',
    });

    res.status(201).json({
      callId: callId.toString(),
      roomName: livekitRoomName,
      serverUrl: url,
      token: jwt,
      initiatorId: req.user._id.toString(),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to start call' });
  }
};

export const getCallToken = async (req, res) => {
  try {
    const call = req.call;
    if (await finalizeCallIfLiveKitRoomEmpty(call)) {
      return res.status(410).json({ message: 'Call has ended' });
    }
    const me = await User.findById(req.user._id).select('username').lean();
    const url = getLiveKitWsUrl();
    const jwt = await mintParticipantToken({
      identity: req.user._id.toString(),
      name: me?.username,
      roomName: call.livekitRoomName,
    });

    if (req.user._id.toString() !== call.initiatorId.toString()) {
      publishCallSignal(call.groupId.toString(), {
        kind: 'call_accepted',
        callId: call._id.toString(),
        groupId: call.groupId.toString(),
        userId: req.user._id.toString(),
        username: me?.username || 'Member',
      });
    }

    res.json({
      serverUrl: url,
      token: jwt,
      roomName: call.livekitRoomName,
      callId: call._id.toString(),
      initiatorId: call.initiatorId.toString(),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to issue token' });
  }
};

/** Leave LiveKit only — if nobody remains, end the meeting for the chat */
export const leaveCall = async (req, res) => {
  try {
    const call = req.call;
    res.json({ ok: true });
    setTimeout(() => {
      finalizeCallIfLiveKitRoomEmpty(call, { minAgeMs: null }).catch(() => {});
    }, 900);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed' });
  }
};

export const rejectCall = async (req, res) => {
  try {
    const call = req.call;
    publishCallSignal(call.groupId.toString(), {
      kind: 'call_rejected',
      callId: call._id.toString(),
      groupId: call.groupId.toString(),
      userId: req.user._id.toString(),
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed' });
  }
};

/** End meeting for everyone in this chat */
export const endCall = async (req, res) => {
  try {
    const call = req.call;
    await Call.updateOne({ _id: call._id }, { status: 'ended' });
    publishCallSignal(call.groupId.toString(), {
      kind: 'call_ended',
      callId: call._id.toString(),
      groupId: call.groupId.toString(),
      endedBy: req.user._id.toString(),
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to end call' });
  }
};
