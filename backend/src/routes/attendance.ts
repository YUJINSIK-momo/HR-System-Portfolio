import { Router } from 'express';
import { checkIn, checkOut, getMyAttendance, getAttendanceList, getAllAttendance, getForeignFreelancerAttendance, resetAttendance, updateAttendance, exportAttendanceToExcel } from '../controllers/attendance.controller';
import { authenticate, requirePasswordChanged, requireRole, requireManagerOrCsChief, requireDesignerOrManagerOrCsChief } from '../middleware/auth';

const router = Router();

router.use(authenticate, requirePasswordChanged);

router.post('/check-in', checkIn);
router.post('/check-out', checkOut);
router.get('/me', getMyAttendance);
router.get('/history', getAttendanceList);
// 근태 현황 vs 외국인 전용: 경로 완전 분리 (충돌 방지)
router.get('/admin/export', requireManagerOrCsChief, exportAttendanceToExcel);
router.get('/admin', requireManagerOrCsChief, getAllAttendance);
router.get('/admin/foreign-freelancers', requireDesignerOrManagerOrCsChief, getForeignFreelancerAttendance);
router.patch('/:id', requireManagerOrCsChief, updateAttendance);
router.delete('/:id/reset', requireManagerOrCsChief, resetAttendance);

export default router;
