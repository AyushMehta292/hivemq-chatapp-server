import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

/** Room Service uses HTTPS; client WS URL is usually wss:// */
export function liveKitWsUrlToHttpHost(wsOrHttpsUrl) {
  const raw = wsOrHttpsUrl.trim();
  if (raw.startsWith('wss://')) {
    const rest = raw.slice('wss://'.length).split('/')[0];
    return `https://${rest}`;
  }
  if (raw.startsWith('ws://')) {
    const rest = raw.slice('ws://'.length).split('/')[0];
    return `http://${rest}`;
  }
  if (raw.startsWith('https://') || raw.startsWith('http://')) {
    try {
      const u = new URL(raw);
      return `${u.protocol}//${u.host}`;
    } catch {
      return raw;
    }
  }
  return `https://${raw.split('/')[0]}`;
}

export async function verifyLiveKitOnStartup() {
  const wsUrl = process.env.LIVEKIT_URL?.trim();
  const key = process.env.LIVEKIT_API_KEY?.trim();
  const secret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!wsUrl || !key || !secret) {
    console.warn(
      'LiveKit credentials missing; voice/video disabled until LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET are set.'
    );
    return;
  }
  try {
    const httpHost = liveKitWsUrlToHttpHost(wsUrl);
    const client = new RoomServiceClient(httpHost, key, secret, { requestTimeout: 8000 });
    await client.listRooms([]);
    let hostname = httpHost;
    try {
      hostname = new URL(httpHost).hostname;
    } catch {
      /* keep httpHost */
    }
    console.log(`LiveKit connected: ${hostname}`);
  } catch (err) {
    console.warn('LiveKit API check failed:', err.message || err);
  }
}

export function getLiveKitWsUrl() {
  let u = process.env.LIVEKIT_URL?.trim();
  if (!u) {
    throw new Error('LIVEKIT_URL is not set');
  }
  u = u.replace(/\/+$/, '');
  return u;
}

/**
 * @returns {Promise<number|null>} participant count, or null if LiveKit is not configured (skip sync)
 */
export async function countParticipantsInRoom(roomName) {
  const wsUrl = process.env.LIVEKIT_URL?.trim();
  const key = process.env.LIVEKIT_API_KEY?.trim();
  const secret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!wsUrl || !key || !secret) return null;
  try {
    const httpHost = liveKitWsUrlToHttpHost(wsUrl);
    const client = new RoomServiceClient(httpHost, key, secret, { requestTimeout: 8000 });
    const participants = await client.listParticipants(String(roomName));
    return participants.length;
  } catch {
    return 0;
  }
}

export async function mintParticipantToken({ identity, name, roomName }) {
  const token = new AccessToken(undefined, undefined, {
    identity: String(identity),
    name: name ? String(name) : String(identity),
    ttl: '2h',
  });
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  return token.toJwt();
}
