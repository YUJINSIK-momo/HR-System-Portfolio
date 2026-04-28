import { Router } from 'express';
import {
  getAll,
  getById,
  create,
  updateAnnouncement,
  addReaction,
  addComment,
  deleteAnnouncement,
  presignAnnouncementUpload,
  setPinned,
} from '../controllers/announcements.controller';
import { authenticate, requirePasswordChanged, requireManagerOrCsChief } from '../middleware/auth';

const router = Router();

router.use(authenticate, requirePasswordChanged);

router.get('/', getAll);
router.get('/:id', getById);
router.post('/presign-upload', requireManagerOrCsChief, presignAnnouncementUpload);
router.post('/', requireManagerOrCsChief, create);
router.patch('/:id/pin', requireManagerOrCsChief, setPinned);
router.patch('/:id', requireManagerOrCsChief, updateAnnouncement);
router.post('/:id/reaction', addReaction);
router.post('/:id/comment', addComment);
router.delete('/:id', requireManagerOrCsChief, deleteAnnouncement);

export default router;
