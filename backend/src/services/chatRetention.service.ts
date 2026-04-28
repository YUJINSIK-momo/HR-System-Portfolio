import prisma from '../lib/prisma';
import { ONE_YEAR_MS } from '../constants/retention';
import { deleteS3Object } from './s3.service';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** 1년 초과 메시지 및 첨부파일 삭제 (전체 채널) */
export async function runChatRetention(): Promise<{ deletedMessages: number }> {
  const cutoff = new Date(Date.now() - ONE_YEAR_MS);

  const toDelete = await prisma.chatMessage.findMany({
    where: { createdAt: { lt: cutoff } },
    select: { id: true, attachments: { select: { s3Key: true } } },
  });

  for (const msg of toDelete) {
    for (const att of msg.attachments) {
      await deleteS3Object(att.s3Key);
    }
  }

  const result = await prisma.chatMessage.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return { deletedMessages: result.count };
}

/**
 * 디자인 요청 알림(design-notify-*) · 시안 알림(draft-notify-*) 채널 메시지를
 * 7일 초과분 자동 삭제 (S3 첨부 포함)
 */
export async function runDesignDraftChatRetention(): Promise<{ deletedMessages: number }> {
  const cutoff = new Date(Date.now() - SEVEN_DAYS_MS);

  const toDelete = await prisma.chatMessage.findMany({
    where: {
      createdAt: { lt: cutoff },
      channel: {
        OR: [
          { slug: { startsWith: 'design-notify-' } },
          { slug: { startsWith: 'draft-notify-' } },
        ],
      },
    },
    select: { id: true, attachments: { select: { s3Key: true } } },
  });

  for (const msg of toDelete) {
    for (const att of msg.attachments) {
      await deleteS3Object(att.s3Key);
    }
  }

  const result = await prisma.chatMessage.deleteMany({
    where: {
      createdAt: { lt: cutoff },
      channel: {
        OR: [
          { slug: { startsWith: 'design-notify-' } },
          { slug: { startsWith: 'draft-notify-' } },
        ],
      },
    },
  });

  return { deletedMessages: result.count };
}
