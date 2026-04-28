import { Router } from 'express';
import multer from 'multer';
import { authenticate, requirePasswordChanged, requireRole } from '../middleware/auth';
import { postLogoPixelGenerate } from '../controllers/logo-pixel.controller';

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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
  },
});

router.use(authenticate, requirePasswordChanged, requireChatAccess);
router.post('/generate', upload.single('image'), postLogoPixelGenerate);

export default router;
