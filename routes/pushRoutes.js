import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { getVapidKey, subscribePush, unsubscribePush } from '../controllers/pushController.js';

const router = Router();

router.get('/vapid-public-key', authenticate, getVapidKey);
router.post('/subscribe', authenticate, subscribePush);
router.post('/unsubscribe', authenticate, unsubscribePush);

export default router;
