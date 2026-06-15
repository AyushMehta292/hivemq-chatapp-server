import 'dotenv/config';
import { getMQTTClient } from '../services/mqttService.js';
import { initPush } from '../services/pushService.js';
import app from '../app.js';

initPush();
getMQTTClient();

export default app;
