import { Router } from 'express';
import { createUser, getUsers, resetUserPassword, updateUser, deleteUser, setLeaveBalance, syncLeaveBalance, getAvatarUploadUrl, updateMyAvatar, getAvatarUrl } from '../controllers/users.controller';
import { authenticate, requireRole, requireManagerOrCsChief, requirePasswordChanged } from '../middleware/auth';

const router = Router();

router.use(authenticate, requirePasswordChanged);

// 본인 아바타 관련 (관리자 권한 불필요)
router.post('/me/avatar/upload-url', getAvatarUploadUrl);
router.patch('/me/avatar', updateMyAvatar);
router.get('/:id/avatar-url', getAvatarUrl);

router.get('/', requireManagerOrCsChief, getUsers);
router.post('/', requireManagerOrCsChief, createUser);
router.post('/sync-leave-balance', requireManagerOrCsChief, syncLeaveBalance);
router.patch('/:id', requireManagerOrCsChief, updateUser);
router.post('/:id/reset-password', requireManagerOrCsChief, resetUserPassword);
router.patch('/:id/leave-balance', requireManagerOrCsChief, setLeaveBalance);
router.delete('/:id', requireRole('SUPER_ADMIN'), deleteUser);

export default router;
