import { Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { deleteS3Object, getPresignedDownloadUrl, getPresignedUploadUrlForAnnouncement } from '../services/s3.service';

const MAX_ANNOUNCEMENT_IMAGES = 20;

const createSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요.'),
  content: z.string().min(1, '내용을 입력해주세요.'),
  imageS3Keys: z.array(z.string()).max(MAX_ANNOUNCEMENT_IMAGES).optional(),
  isPinned: z.boolean().optional(),
});

const commentSchema = z.object({
  content: z.string().min(1, '댓글을 입력해주세요.'),
});

const reactionSchema = z.object({
  emoji: z.enum(['👍', '❤️', '😂', '👏', '🔥']),
});

function announcementImageKeyForUser(userId: string, key: string | null | undefined): boolean {
  return typeof key === 'string' && key.startsWith(`announcements/${userId}/`);
}

const announcementInclude = {
  author: { include: { profile: true } },
  images: { orderBy: { sortOrder: 'asc' as const } },
  reactions: { include: { user: { include: { profile: true } } } },
  comments: {
    orderBy: { createdAt: 'asc' as const },
    include: { user: { include: { profile: true } } },
  },
} as const;

async function hydrateAnnouncementImages(row: {
  images: { id: string; s3Key: string; sortOrder: number }[];
  [key: string]: unknown;
}) {
  const images = await Promise.all(
    row.images.map(async (im) => ({
      id: im.id,
      s3Key: im.s3Key,
      sortOrder: im.sortOrder,
      imageUrl: await getPresignedDownloadUrl(im.s3Key),
    }))
  );
  return { ...row, images };
}

export const presignAnnouncementUpload = async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    filename: z.string().min(1),
    mimeType: z.string().min(1),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: result.error.errors[0].message });
    return;
  }
  const { filename, mimeType } = result.data;
  const out = await getPresignedUploadUrlForAnnouncement(filename, mimeType, req.user!.id);
  if (!out) {
    res.status(503).json({ message: '이미지 업로드 설정(S3)이 없거나 이미지 형식이 아닙니다.' });
    return;
  }
  res.json(out);
};

export const getAll = async (_req: AuthRequest, res: Response): Promise<void> => {
  const announcements = await prisma.announcement.findMany({
    orderBy: [{ isPinned: 'desc' }, { pinnedAt: 'desc' }, { createdAt: 'desc' }],
    include: {
      author: { include: { profile: true } },
      images: { orderBy: { sortOrder: 'asc' } },
      reactions: { include: { user: { include: { profile: true } } } },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: { user: { include: { profile: true } } },
      },
    },
  });

  const withUrls = await Promise.all(announcements.map((a) => hydrateAnnouncementImages(a)));
  res.json(withUrls);
};

export const getById = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const row = await prisma.announcement.findUnique({
    where: { id },
    include: announcementInclude,
  });
  if (!row) {
    res.status(404).json({ message: '공지사항을 찾을 수 없습니다.' });
    return;
  }
  res.json(await hydrateAnnouncementImages(row));
};

export const create = async (req: AuthRequest, res: Response): Promise<void> => {
  const result = createSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: result.error.errors[0].message });
    return;
  }

  const { title, content, imageS3Keys, isPinned } = result.data;
  const uid = req.user!.id;
  const keys = imageS3Keys ?? [];

  for (const key of keys) {
    if (!announcementImageKeyForUser(uid, key)) {
      res.status(400).json({ message: '유효하지 않은 이미지 키입니다.' });
      return;
    }
  }

  const pinned = !!isPinned;
  const announcement = await prisma.announcement.create({
    data: {
      title,
      content,
      isPinned: pinned,
      pinnedAt: pinned ? new Date() : null,
      authorId: uid,
      images: {
        create: keys.map((s3Key, i) => ({ s3Key, sortOrder: i })),
      },
    },
    include: announcementInclude,
  });

  const withUrls = await hydrateAnnouncementImages(announcement);
  res.status(201).json(withUrls);
};

const updateSchema = createSchema;

export const updateAnnouncement = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const result = updateSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: result.error.errors[0].message });
    return;
  }

  const { title, content, imageS3Keys, isPinned } = result.data;
  const uid = req.user!.id;

  const existing = await prisma.announcement.findUnique({
    where: { id },
    include: { images: true },
  });
  if (!existing) {
    res.status(404).json({ message: '공지사항을 찾을 수 없습니다.' });
    return;
  }

  const keys = imageS3Keys ?? undefined;
  if (keys !== undefined) {
    const existingKeySet = new Set(existing.images.map((im) => im.s3Key));
    for (const key of keys) {
      if (existingKeySet.has(key)) continue;
      if (!announcementImageKeyForUser(uid, key)) {
        res.status(400).json({ message: '유효하지 않은 이미지 키입니다.' });
        return;
      }
    }

    const newKeySet = new Set(keys);
    for (const im of existing.images) {
      if (!newKeySet.has(im.s3Key)) {
        await deleteS3Object(im.s3Key);
      }
    }

    await prisma.announcementImage.deleteMany({ where: { announcementId: id } });
    if (keys.length > 0) {
      await prisma.announcementImage.createMany({
        data: keys.map((s3Key, i) => ({ announcementId: id, s3Key, sortOrder: i })),
      });
    }
  }

  const nextPinned = isPinned !== undefined ? !!isPinned : existing.isPinned;
  const updated = await prisma.announcement.update({
    where: { id },
    data: {
      title,
      content,
      isPinned: nextPinned,
      pinnedAt: nextPinned ? (existing.pinnedAt ?? new Date()) : null,
    },
    include: announcementInclude,
  });

  const withUrls = await hydrateAnnouncementImages(updated);
  res.json(withUrls);
};

export const setPinned = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const parsed = z.object({ pinned: z.boolean() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.errors[0].message });
    return;
  }
  const { pinned } = parsed.data;

  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ message: '공지사항을 찾을 수 없습니다.' });
    return;
  }

  const updated = await prisma.announcement.update({
    where: { id },
    data: {
      isPinned: pinned,
      pinnedAt: pinned ? new Date() : null,
    },
    include: announcementInclude,
  });

  const withUrls = await hydrateAnnouncementImages(updated);
  res.json(withUrls);
};

export const addReaction = async (req: AuthRequest, res: Response): Promise<void> => {
  const result = reactionSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: result.error.errors[0].message });
    return;
  }

  const { id } = req.params;
  const { emoji } = result.data;

  const announcement = await prisma.announcement.findUnique({ where: { id } });
  if (!announcement) {
    res.status(404).json({ message: '공지사항을 찾을 수 없습니다.' });
    return;
  }

  const existing = await prisma.announcementReaction.findUnique({
    where: {
      announcementId_userId: { announcementId: id, userId: req.user!.id },
    },
  });

  if (existing) {
    if (existing.emoji === emoji) {
      await prisma.announcementReaction.delete({ where: { id: existing.id } });
      const updated = await prisma.announcement.findUnique({
        where: { id },
        include: announcementInclude,
      });
      res.json(updated ? await hydrateAnnouncementImages(updated) : null);
      return;
    }
    await prisma.announcementReaction.update({
      where: { id: existing.id },
      data: { emoji },
    });
  } else {
    await prisma.announcementReaction.create({
      data: {
        announcementId: id,
        userId: req.user!.id,
        emoji,
      },
    });
  }

  const updated = await prisma.announcement.findUnique({
    where: { id },
    include: announcementInclude,
  });

  res.json(updated ? await hydrateAnnouncementImages(updated) : null);
};

export const addComment = async (req: AuthRequest, res: Response): Promise<void> => {
  const result = commentSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: result.error.errors[0].message });
    return;
  }

  const { id } = req.params;
  const { content } = result.data;

  const announcement = await prisma.announcement.findUnique({ where: { id } });
  if (!announcement) {
    res.status(404).json({ message: '공지사항을 찾을 수 없습니다.' });
    return;
  }

  await prisma.announcementComment.create({
    data: {
      announcementId: id,
      userId: req.user!.id,
      content,
    },
  });

  const updated = await prisma.announcement.findUnique({
    where: { id },
    include: announcementInclude,
  });

  res.json(updated ? await hydrateAnnouncementImages(updated) : null);
};

export const deleteAnnouncement = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const announcement = await prisma.announcement.findUnique({
    where: { id },
    include: { images: true },
  });
  if (!announcement) {
    res.status(404).json({ message: '공지사항을 찾을 수 없습니다.' });
    return;
  }

  if (announcement.authorId !== req.user!.id && req.user!.role !== 'SUPER_ADMIN') {
    res.status(403).json({ message: '삭제 권한이 없습니다.' });
    return;
  }

  for (const im of announcement.images) {
    await deleteS3Object(im.s3Key);
  }

  await prisma.announcement.delete({ where: { id } });
  res.json({ message: '공지사항이 삭제되었습니다.' });
};
