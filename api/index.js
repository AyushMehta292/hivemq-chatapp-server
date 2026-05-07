import 'dotenv/config';
import { getMQTTClient } from '../services/mqttService.js';
import app from '../app.js';

getMQTTClient();

export default app;
