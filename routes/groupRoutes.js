import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../middleware/authenticate.js';
import { requireGroupMember, requireGroupAdmin } from '../middleware/groupMember.js';
import { createGroup, getMyGroups, getOrCreateDirectGroup, getOrCreateSelfGroup, getGroup, updateGroup, leaveGroup } from '../controllers/groupController.js';

const router = express.Router();
router.use(authenticate);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

router.post(
  '/',
  [body('name').trim().notEmpty().optional(), body('memberIds').optional().isArray()],
  validate,
  createGroup
);
router.get('/', getMyGroups);
router.post('/direct', [body('otherUserId').isMongoId()], validate, getOrCreateDirectGroup);
router.get('/self', getOrCreateSelfGroup);
router.get('/:groupId', requireGroupMember, getGroup);
router.patch(
  '/:groupId',
  [
    body('name').trim().isLength({ min: 1, max: 100 }).optional(),
    body('memberIds').optional().isArray(),
    body('memberIds.*').optional().isMongoId(),
  ],
  validate,
  requireGroupAdmin,
  updateGroup
);
router.post('/:groupId/leave', requireGroupMember, leaveGroup);

export default router;
