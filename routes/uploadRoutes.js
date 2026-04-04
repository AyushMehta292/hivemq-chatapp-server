import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { uploadGeneric } from '../middleware/upload.js';
import { uploadFile } from '../controllers/uploadController.js';

const router = express.Router();

router.post('/', authenticate, uploadGeneric, uploadFile);

export default router;
