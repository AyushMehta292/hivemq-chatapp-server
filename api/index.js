import 'dotenv/config';
import { connectDB } from '../config/db.js';
import { getMQTTClient } from '../services/mqttService.js';
import app from '../app.js';

connectDB();
getMQTTClient();

export default app;
