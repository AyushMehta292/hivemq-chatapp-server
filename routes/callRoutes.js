import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireGroupMember } from '../middleware/groupMember.js';
import { requireCallParticipant } from '../middleware/callMember.js';
import {
  startCall,
  getActiveCallForGroup,
  getCallToken,
  leaveCall,
  rejectCall,
  endCall,
} from '../controllers/callController.js';

const router = express.Router();
router.use(authenticate);

router.post('/start', requireGroupMember, startCall);
router.get('/active/:groupId', requireGroupMember, getActiveCallForGroup);
router.post('/:callId/token', requireCallParticipant, getCallToken);
router.post('/:callId/leave', requireCallParticipant, leaveCall);
router.post('/:callId/reject', requireCallParticipant, rejectCall);
router.post('/:callId/end', requireCallParticipant, endCall);

export default router;
