import { Router } from 'express';
import { requestLeave, getMyLeaveBalance, getMyLeaveRequests, approveLeave, rejectLeave, revokeLeave, getAllLeaveRequests, getFreelancerLeaveRequests, getLeaveNotifications, exportLeaveToExcel, getApprovedLeavesForSchedule } from '../controllers/leave.controller';
import { authenticate, requirePasswordChanged, requireRole, requireManagerOrCsChief, requireDesignerOrManagerOrCsChief } from '../middleware/auth';

const router = Router();

router.use(authenticate, requirePasswordChanged);

router.post('/request', requestLeave);
router.get('/balance', getMyLeaveBalance);
router.get('/requests', getMyLeaveRequests);
router.get(
  '/notifications',
  requireRole('EMPLOYEE', 'PLANNING', 'CS', 'DESIGNER', 'MANAGER', 'SUPER_ADMIN', 'FOREIGN_FREELANCER'),
  getLeaveNotifications
);
router.get('/admin/export', requireManagerOrCsChief, exportLeaveToExcel);
router.get('/admin/requests', requireManagerOrCsChief, getAllLeaveRequests);
router.get('/admin/freelancer-requests', requireDesignerOrManagerOrCsChief, getFreelancerLeaveRequests);
router.get('/approved-for-schedule', requireManagerOrCsChief, getApprovedLeavesForSchedule);
router.patch('/requests/:id/approve', requireManagerOrCsChief, approveLeave);
router.patch('/requests/:id/reject', requireManagerOrCsChief, rejectLeave);
router.patch('/requests/:id/revoke', requireManagerOrCsChief, revokeLeave);
router.patch('/admin/freelancer-requests/:id/approve', requireDesignerOrManagerOrCsChief, approveLeave);
router.patch('/admin/freelancer-requests/:id/reject', requireDesignerOrManagerOrCsChief, rejectLeave);
router.patch('/admin/freelancer-requests/:id/revoke', requireDesignerOrManagerOrCsChief, revokeLeave);

export default router;
