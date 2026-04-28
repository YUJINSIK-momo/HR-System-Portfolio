import { Router } from 'express';
import {
  createAttendanceCorrectionRequest,
  getMyAttendanceCorrectionRequests,
  getAllAttendanceCorrectionRequests,
  getForeignFreelancerAttendanceCorrectionRequests,
  approveAttendanceCorrectionRequest,
  rejectAttendanceCorrectionRequest,
} from '../controllers/attendanceCorrection.controller';
import {
  authenticate,
  requirePasswordChanged,
  requireManagerOrCsChief,
  requireDesignerOrManagerOrCsChief,
} from '../middleware/auth';

const router = Router();

router.use(authenticate, requirePasswordChanged);

router.post('/', createAttendanceCorrectionRequest);
router.get('/me', getMyAttendanceCorrectionRequests);
router.get('/admin', requireManagerOrCsChief, getAllAttendanceCorrectionRequests);
router.get(
  '/admin/foreign-freelancers',
  requireDesignerOrManagerOrCsChief,
  getForeignFreelancerAttendanceCorrectionRequests
);
router.patch(
  '/:id/approve',
  requireDesignerOrManagerOrCsChief,
  approveAttendanceCorrectionRequest
);
router.patch(
  '/:id/reject',
  requireDesignerOrManagerOrCsChief,
  rejectAttendanceCorrectionRequest
);

export default router;
