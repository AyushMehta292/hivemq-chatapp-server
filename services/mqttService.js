import mqtt from 'mqtt';

let client = null;

const DEFAULT_HOST = 'bf88379b1d754c5f9e53b81f7b1b4aa6.s1.eu.hivemq.cloud';
const PUBLISH_TIMEOUT_MS = 8000;

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

function publishWhenReady(topic, payload) {
  const c = getMQTTClient();
  if (!c) return Promise.resolve();

  const data = JSON.stringify(payload);
  const doPublish = () =>
    new Promise((resolve) => {
      c.publish(topic, data, { qos: 1 }, (err) => {
        if (err) console.error('MQTT publish error:', err);
        resolve();
      });
    });

  if (c.connected) return doPublish();

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn(`MQTT publish skipped (timeout): ${topic}`);
      resolve();
    }, PUBLISH_TIMEOUT_MS);

    const finish = () => {
      clearTimeout(timeout);
      doPublish().then(resolve);
    };

    if (c.connected) {
      finish();
      return;
    }

    c.once('connect', finish);
  });
}

export const publishToGroup = (groupId, payload) => {
  return publishWhenReady(`chat/group/${groupId}`, payload);
};

export const publishCallSignal = (groupId, payload) => {
  return publishWhenReady(`chat/call/${groupId}`, payload);
};
