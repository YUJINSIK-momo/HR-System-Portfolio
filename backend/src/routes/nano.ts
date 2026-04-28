import { Router } from 'express';
import multer from 'multer';
import { authenticate, requirePasswordChanged, requireRole } from '../middleware/auth';
import { postNanoGenerate, getNanoGuideline } from '../controllers/nano.controller';

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

/** express.json limit(30mb)와 맞춤 — 목업용 고해상도 이미지 대비 */
const NANO_MAX_FILE_BYTES = 3 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: NANO_MAX_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
  },
});

router.use(authenticate, requirePasswordChanged, requireChatAccess);
router.get('/guideline', getNanoGuideline);
router.post(
  '/generate',
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'logo', maxCount: 1 },
  ]),
  postNanoGenerate
);

export default router;
