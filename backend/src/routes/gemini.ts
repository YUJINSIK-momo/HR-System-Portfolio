import { Router } from 'express';
import { authenticate, requirePasswordChanged, requireRole } from '../middleware/auth';
import { postGeminiChat } from '../controllers/gemini.controller';

const router = Router();

const requireChatAccess = requireRole(
  'MANAGER',
  'SUPER_ADMIN',
  'DESIGNER',
  'FOREIGN_FREELANCER',
  'CS',
  'EMPLOYEE',
  'PLANNING'
);

router.use(authenticate, requirePasswordChanged, requireChatAccess);
router.post('/chat', postGeminiChat);

export default router;
