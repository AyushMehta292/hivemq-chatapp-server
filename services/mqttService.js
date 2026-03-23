import mqtt from 'mqtt';

let client = null;

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

export const getMQTTClient = () => {
  if (client?.connected) return client;
  if (client && !client.connected) return client;
  const username = process.env.HIVEMQ_USER;
  const password = process.env.HIVEMQ_PASSWORD;
  if (!username || !password) {
    console.warn('HiveMQ credentials missing; MQTT publish disabled.');
    return null;
  }
  const url = normalizeMqttUrl(process.env.HIVEMQ_WS_URL);
  try {
    client = mqtt.connect(url, {
      username,
      password,
      protocol: 'wss',
      reconnectPeriod: 5000,
    });
    client.on('error', (err) => console.error('MQTT error:', err.message || err));
    client.on('connect', () => console.log('MQTT connected to HiveMQ'));
  } catch (err) {
    console.error('MQTT connect failed:', err.message || err);
    return null;
  }
  return client;
};

export const publishToGroup = (groupId, payload) => {
  const c = getMQTTClient();
  if (!c?.connected) return;
  const topic = `chat/group/${groupId}`;
  c.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
    if (err) console.error('MQTT publish error:', err);
  });
};
