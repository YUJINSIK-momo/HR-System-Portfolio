import { Router } from 'express';
import { getHolidays, syncHolidays } from '../controllers/holidays.controller';
import { authenticate, requirePasswordChanged, requireManagerOrCsChief } from '../middleware/auth';

const router = Router();

router.use(authenticate, requirePasswordChanged);
router.get('/', getHolidays);
router.post('/sync', requireManagerOrCsChief, syncHolidays);

export default router;
