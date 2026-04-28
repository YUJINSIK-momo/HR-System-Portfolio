import { Router } from 'express';
import {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getMemos,
  getMemoReminders,
  createMemo,
  updateMemo,
  deleteMemo,
  getLeaves,
} from '../controllers/calendar.controller';
import { authenticate, requirePasswordChanged } from '../middleware/auth';

const router = Router();

router.use(authenticate, requirePasswordChanged);

router.get('/events', getEvents);
router.post('/events', createEvent);
router.patch('/events/:id', updateEvent);
router.delete('/events/:id', deleteEvent);

router.get('/memos', getMemos);
router.get('/memo-reminders', getMemoReminders);
router.post('/memos', createMemo);
router.patch('/memos/:id', updateMemo);
router.delete('/memos/:id', deleteMemo);

router.get('/leaves', getLeaves);

export default router;
