import { Router } from 'express';
import { authenticate, requirePasswordChanged, requireManagerSuperOrCs } from '../middleware/auth';
import {
  adminListDesignFixedPhrases,
  createDesignFixedPhrase,
  updateDesignFixedPhrase,
  deleteDesignFixedPhrase,
} from '../controllers/designFixedPhrase.controller';

const router = Router();

router.use(authenticate, requirePasswordChanged, requireManagerSuperOrCs);
router.get('/', adminListDesignFixedPhrases);
router.post('/', createDesignFixedPhrase);
router.patch('/:id', updateDesignFixedPhrase);
router.delete('/:id', deleteDesignFixedPhrase);

export default router;
