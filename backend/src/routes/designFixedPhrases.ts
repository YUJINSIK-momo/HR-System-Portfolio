import { Router } from 'express';
import { authenticate, requirePasswordChanged, requireDesignRequestCreator } from '../middleware/auth';
import { listDesignFixedPhrases } from '../controllers/designFixedPhrase.controller';

const router = Router();

router.use(authenticate, requirePasswordChanged, requireDesignRequestCreator);
router.get('/', listDesignFixedPhrases);

export default router;
