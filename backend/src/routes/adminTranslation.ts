import { Router } from 'express';
import { authenticate, requirePasswordChanged, requireTranslationEditor } from '../middleware/auth';
import {
  createDictionaryEntry,
  deleteDictionaryEntry,
  exportTranslationBackup,
  getGuideline,
  importDictionaryJson,
  listDictionary,
  listDictionaryCategories,
  listGuidelines,
  putGuideline,
  syncGuidelinesFromRepo,
  updateDictionaryEntry,
} from '../controllers/translationAdmin.controller';

const router = Router();

router.use(authenticate, requirePasswordChanged);

router.get('/backup', requireTranslationEditor, exportTranslationBackup);

router.get('/dictionary/categories', listDictionaryCategories);
router.get('/dictionary', listDictionary);
router.post('/dictionary', requireTranslationEditor, createDictionaryEntry);
router.post('/dictionary/import-json', requireTranslationEditor, importDictionaryJson);
router.patch('/dictionary/:id', requireTranslationEditor, updateDictionaryEntry);
router.delete('/dictionary/:id', requireTranslationEditor, deleteDictionaryEntry);

router.get('/guidelines', listGuidelines);
router.post('/guidelines/sync-from-repo', requireTranslationEditor, syncGuidelinesFromRepo);
router.get('/guidelines/:name', getGuideline);
router.put('/guidelines/:name', requireTranslationEditor, putGuideline);

export default router;
