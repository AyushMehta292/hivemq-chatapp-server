import 'dotenv/config';
import { connectDB } from './config/db.js';
import { getMQTTClient } from './services/mqttService.js';
import { verifyLiveKitOnStartup } from './services/livekitService.js';
import app from './app.js';

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  console.log('MongoDB ready');
  app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    getMQTTClient();
    await verifyLiveKitOnStartup();
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
