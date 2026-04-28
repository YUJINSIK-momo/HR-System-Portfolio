import { Router } from 'express';
import { authenticate, requirePasswordChanged, requireDesignRequestStatsAccess } from '../middleware/auth';
import {
  addReply,
  createDesignRequest,
  dailyStatsDesignRequests,
  deleteDesignRequest,
  deleteReply,
  getAttachmentDownloadUrl,
  getDesignRequest,
  checkDuplicateDesignRequest,
  getDesignRequestSiblings,
  getReplyAttachmentDownloadUrl,
  getReplyAttachmentCustomerDownload,
  getReplyUploadUrl,
  getUploadUrl,
  listAssignees,
  listDesignRequests,
  patchDesignRequest,
  patchReply,
  statsDesignRequests,
} from '../controllers/designRequest.controller';

const router = Router();

router.use(authenticate, requirePasswordChanged);

router.get('/stats', statsDesignRequests);
router.get('/daily-stats', requireDesignRequestStatsAccess, dailyStatsDesignRequests);
router.get('/assignees', listAssignees);
router.get('/designers', listAssignees);
router.post('/upload-url', getUploadUrl);
router.get('/attachments/:attachmentId/download-url', getAttachmentDownloadUrl);
router.get('/reply-attachments/:attachmentId/download-url', getReplyAttachmentDownloadUrl);
router.get('/reply-attachments/:attachmentId/customer-download', getReplyAttachmentCustomerDownload);
router.get('/', listDesignRequests);
router.get('/check-duplicate', checkDuplicateDesignRequest);
router.post('/', createDesignRequest);
router.patch('/:id', patchDesignRequest);
router.delete('/:id', deleteDesignRequest);
router.post('/:id/reply-upload-url', getReplyUploadUrl);
router.post('/:id/replies', addReply);
router.patch('/:id/replies/:replyId', patchReply);
router.delete('/:id/replies/:replyId', deleteReply);
router.get('/:id/siblings', getDesignRequestSiblings);
router.get('/:id', getDesignRequest);

export default router;
