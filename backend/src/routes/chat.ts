import { Router } from 'express';
import {
  authenticate,
  requirePasswordChanged,
  requireRole,
} from '../middleware/auth';
import {
  addReaction,
  createMessage,
  deleteMessage,
  getChannelAttachments,
  getChannels,
  markChannelRead,
  getDownloadUrl,
  getMentionedMessages,
  getMessages,
  getOrCreateDmChannel,
  getTaggableUsers,
  getUploadUrl,
  removeReaction,
  searchMessages,
  translateMessage,
  updateMessage,
  patchChannel,
} from '../controllers/chat.controller';

const router = Router();

/** 채팅: 전 직원 + 디자인 알림 채널 열람 (CS·직원 포함) */
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

router.get('/channels', getChannels);
router.patch('/channels/:channelId', patchChannel);
router.post('/channels/:channelId/read', markChannelRead);
router.get('/taggable-users', getTaggableUsers);
router.get('/mentions', getMentionedMessages);
router.post('/dm', getOrCreateDmChannel);
router.get('/channels/:channelId/messages', getMessages);
router.get('/channels/:channelId/search', searchMessages);
router.get('/channels/:channelId/attachments', getChannelAttachments);
router.post('/channels/:channelId/messages', createMessage);
router.patch('/channels/:channelId/messages/:messageId', updateMessage);
router.delete('/channels/:channelId/messages/:messageId', deleteMessage);
router.post('/messages/:messageId/reactions', addReaction);
router.delete('/messages/:messageId/reactions/:emoji', removeReaction);
router.post('/upload-url', getUploadUrl);
router.get('/attachment/:attachmentId/download-url', getDownloadUrl);
router.post('/translate', translateMessage);

export default router;
