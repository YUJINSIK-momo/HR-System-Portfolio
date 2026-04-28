import { Router } from 'express';
import { login, changePassword, getMe, patchChatTranslation } from '../controllers/auth.controller';
import { authenticate, requirePasswordChanged } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.post('/change-password', authenticate, changePassword);
router.get('/me', authenticate, requirePasswordChanged, getMe);
router.patch('/me/chat-translation', authenticate, requirePasswordChanged, patchChatTranslation);

export default router;
