import { randomUUID } from 'node:crypto';
import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { deleteS3Object, getPresignedDownloadUrl, getPresignedUploadUrl } from '../services/s3.service';
import { translate } from '../services/translation.service';
import {
  DESIGN_NOTIFY_MSG_PREFIX_NEW,
  DESIGN_NOTIFY_MSG_PREFIX_INITIAL_EDIT,
  DESIGN_NOTIFY_MSG_PREFIX_RE_REQUEST,
  DESIGN_NOTIFY_MSG_PREFIX_RE_REQUEST_EDIT,
  DRAFT_NOTIFY_MSG_PREFIX_COMMENT,
  DRAFT_NOTIFY_MSG_PREFIX_RE_REQUEST,
  DESIGN_REPLY_COMPLETE_MSG_PREFIX,
  DESIGN_REPLY_COMPLETE_RE_REQUEST_MSG_PREFIX,
} from '../services/designRequestNotify.service';
import { z } from 'zod';

const createMessageSchema = z.object({
  content: z.string().max(10000).default(''),
  translatedContent: z.string().max(10000).optional(),
  tags: z.array(z.string()).max(20).optional().default([]),
  attachmentKeys: z.array(z.object({
    s3Key: z.string(),
    filename: z.string(),
    mimeType: z.string(),
    size: z.number(),
  })).max(10).optional().default([]),
  parentMessageId: z.string().uuid().optional().nullable(),
}).refine(
  (data) => data.content.trim().length > 0 || data.attachmentKeys.length > 0,
  { message: '텍스트 또는 첨부파일이 필요합니다.' }
);

const translateSchema = z.object({
  text: z.string().min(1).max(5000),
  fromLang: z.enum(['ko', 'ja', 'en']),
  toLang: z.enum(['ko', 'ja', 'en']),
});

/** slug 형식: dm-{uuid}-{uuid} (participant id 정렬값) */
const DM_SLUG_PARTICIPANTS_RE =
  /^dm-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

function participantIdsFromDmSlug(slug: string): string[] | null {
  const m = DM_SLUG_PARTICIPANTS_RE.exec(slug);
  if (!m) return null;
  return [m[1], m[2]];
}

/** DM 채널의 참가자 ID 목록 (JSON 또는 레거시 slug). DM이 아니면 null */
function dmParticipantIds(channel: {
  type: string;
  slug: string;
  participantIds: unknown;
}): string[] | null {
  if (channel.type === 'DM' && channel.participantIds != null) {
    const raw = channel.participantIds;
    if (Array.isArray(raw)) {
      const ids = raw.filter((x): x is string => typeof x === 'string');
      if (ids.length >= 2) return ids;
    }
  }
  if (channel.slug.startsWith('dm-')) {
    return participantIdsFromDmSlug(channel.slug);
  }
  return null;
}

/** 디자인 요청 자동 알림 (design-notify-*) — DB 미설정 시: 디자이너·관리·대표 */
const DESIGN_NOTIFY_SLUG_PREFIX = 'design-notify-';
/** 시안·코멘트 알림 (draft-notify-*) — DB 미설정 시: CS·관리·대표 */
const DRAFT_NOTIFY_SLUG_PREFIX = 'draft-notify-';

/** 종목 일반 채널 (축구~배구) — `chatChannelsBootstrap` slug와 동일 */
const SPORT_TEAM_SLUGS = new Set([
  'soccer',
  'basketball',
  'baseball',
  'baseball-hof',
  'volleyball',
]);

/** 종목 일반 채팅(축구(채팅) 등) — 전 직원 멘션 가능 */
const SPORT_CHAT_SLUGS = new Set([
  'soccer-chat',
  'basketball-chat',
  'baseball-chat',
  'baseball-hof-chat',
  'volleyball-chat',
]);

function isDesignNotifyChannel(slug: string): boolean {
  return slug.startsWith(DESIGN_NOTIFY_SLUG_PREFIX);
}

function isDraftNotifyChannel(slug: string): boolean {
  return slug.startsWith(DRAFT_NOTIFY_SLUG_PREFIX);
}

function canAccessDesignRequestNotifyChannel(role: string): boolean {
  return (
    role === 'MANAGER' ||
    role === 'SUPER_ADMIN' ||
    role === 'DESIGNER' ||
    role === 'FOREIGN_FREELANCER'
  );
}

function canAccessDraftNotifyChannel(role: string): boolean {
  return role === 'CS' || role === 'MANAGER' || role === 'SUPER_ADMIN';
}

/** 종목 채널: 디자이너·대표·해외 디자이너만 (allowed_roles 미설정 레거시 DB 대비) */
function canAccessSportTeamChannel(role: string): boolean {
  return role === 'DESIGNER' || role === 'SUPER_ADMIN' || role === 'FOREIGN_FREELANCER';
}

/** allowed_roles가 비어 있지 않으면 해당 역할만. 비어 있으면 design-notify는 레거시 규칙, 그 외 전체 */
function roleMatchesChannel(
  role: string | undefined,
  allowedRoles: unknown,
  slug: string
): boolean {
  if (allowedRoles !== null && allowedRoles !== undefined && Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    return role != null && (allowedRoles as string[]).includes(role);
  }
  if (SPORT_TEAM_SLUGS.has(slug)) {
    return !!role && canAccessSportTeamChannel(role);
  }
  if (isDraftNotifyChannel(slug)) {
    return !!role && canAccessDraftNotifyChannel(role);
  }
  if (isDesignNotifyChannel(slug)) {
    return !!role && canAccessDesignRequestNotifyChannel(role);
  }
  return true;
}

/** 공개 채널: allowed_roles·DM 규칙, DM은 참가자만 */
function userCanAccessChannel(
  userId: string,
  channel: { type: string; slug: string; participantIds: unknown; allowedRoles?: unknown },
  role?: string
): boolean {
  const ids = dmParticipantIds(channel);
  if (ids === null) {
    if (channel.type === 'DM') return false;
    return roleMatchesChannel(role, channel.allowedRoles, channel.slug);
  }
  return ids.includes(userId);
}

/** 메시지에 포함된 첨부 — 파일 선택 순서(sort_order)대로 (`npx prisma generate` 후 any 제거 가능) */
const chatAttachmentsOrdered = { orderBy: { sortOrder: 'asc' as const } } as any;

function denyIfNoChannelAccess(
  res: Response,
  userId: string,
  channel: { type: string; slug: string; participantIds: unknown; allowedRoles?: unknown },
  role?: string
): boolean {
  if (!userCanAccessChannel(userId, channel, role)) {
    res.status(403).json({ message: '이 채널에 접근할 권한이 없습니다.' });
    return true;
  }
  return false;
}

type ChannelRow = {
  id: string;
  slug: string;
  name: string;
  order: number;
  type?: string;
  createdAt?: Date;
};

async function enrichChannelsWithUnread(
  userId: string,
  channels: ChannelRow[]
): Promise<
  Array<
    ChannelRow & {
      unreadCount: number;
      unreadChatCount: number;
      unreadGalleryCount: number;
    }
  >
> {
  if (channels.length === 0) return [];
  const ids = channels.map((c) => c.id);
  const reads = await prisma.chatChannelRead.findMany({
    where: { userId, channelId: { in: ids } },
  });
  const readMap = new Map(reads.map((r) => [r.channelId, r]));
  const out: Array<
    ChannelRow & { unreadCount: number; unreadChatCount: number; unreadGalleryCount: number }
  > = [];
  for (const c of channels) {
    const r = readMap.get(c.id);
    const lrChat = r?.lastReadAt ?? new Date(0);
    const lrGal = r?.lastReadGalleryAt ?? r?.lastReadAt ?? new Date(0);
    const isDesignNotify = c.slug.startsWith('design-notify-');
    const isDraftNotify = c.slug.startsWith('draft-notify-');

    let unreadChatCount: number;
    let unreadGalleryCount: number;

    if (isDesignNotify) {
      unreadChatCount = await prisma.chatMessage.count({
        where: {
          channelId: c.id,
          createdAt: { gt: lrChat },
          OR: [
            { content: { startsWith: DESIGN_NOTIFY_MSG_PREFIX_NEW } },
            { content: { startsWith: DESIGN_NOTIFY_MSG_PREFIX_INITIAL_EDIT } },
          ],
        },
      });
      const unreadReRequestMsgs = await prisma.chatMessage.count({
        where: {
          channelId: c.id,
          createdAt: { gt: lrGal },
          OR: [
            { content: { startsWith: DESIGN_NOTIFY_MSG_PREFIX_RE_REQUEST } },
            { content: { startsWith: DESIGN_NOTIFY_MSG_PREFIX_RE_REQUEST_EDIT } },
          ],
        },
      });
      const unreadAttachments = await prisma.chatAttachment.count({
        where: {
          message: { channelId: c.id },
          createdAt: { gt: lrGal },
        },
      });
      unreadGalleryCount = unreadReRequestMsgs + unreadAttachments;
    } else if (isDraftNotify) {
      unreadChatCount = await prisma.chatMessage.count({
        where: {
          channelId: c.id,
          createdAt: { gt: lrChat },
          AND: [
            {
              OR: [
                { content: { startsWith: DRAFT_NOTIFY_MSG_PREFIX_COMMENT } },
                { content: { startsWith: DESIGN_REPLY_COMPLETE_MSG_PREFIX } },
              ],
            },
            { NOT: { content: { startsWith: DRAFT_NOTIFY_MSG_PREFIX_RE_REQUEST } } },
          ],
        },
      });
      unreadGalleryCount = await prisma.chatMessage.count({
        where: {
          channelId: c.id,
          createdAt: { gt: lrGal },
          OR: [
            { content: { startsWith: DRAFT_NOTIFY_MSG_PREFIX_RE_REQUEST } },
            { content: { startsWith: DESIGN_REPLY_COMPLETE_RE_REQUEST_MSG_PREFIX } },
          ],
        },
      });
    } else {
      unreadChatCount = await prisma.chatMessage.count({
        where: { channelId: c.id, createdAt: { gt: lrChat } },
      });
      unreadGalleryCount = await prisma.chatAttachment.count({
        where: {
          message: { channelId: c.id },
          createdAt: { gt: lrGal },
        },
      });
    }

    const unreadCount = unreadChatCount + unreadGalleryCount;
    out.push({ ...c, unreadCount, unreadChatCount, unreadGalleryCount });
  }
  return out;
}

export async function getChannels(req: AuthRequest, res: Response) {
  const userId = req.user!.id;
  const role = req.user!.role;
  try {
    const all = await prisma.chatChannel.findMany({
      orderBy: { order: 'asc' },
    });
    const filtered = all.filter((c) => userCanAccessChannel(userId, c, role));
    let enriched: Array<ChannelRow & { unreadCount: number }>;
    try {
      enriched = await enrichChannelsWithUnread(userId, filtered);
    } catch (err) {
      console.error('[Chat] enrichChannelsWithUnread failed:', err);
      enriched = filtered.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        order: c.order,
        type: c.type,
        createdAt: c.createdAt,
        allowedRoles: (c as { allowedRoles?: unknown }).allowedRoles,
        unreadCount: 0,
        unreadChatCount: 0,
        unreadGalleryCount: 0,
      }));
    }
    return res.json(enriched);
  } catch (e) {
    console.error('[Chat] getChannels primary path failed:', e);
    try {
      // 마이그레이션 미적용 시 type/participant_ids 컬럼 없음 → 기본 컬럼만 조회
      const rows = await prisma.$queryRaw<
        { id: string; slug: string; name: string; order: number; created_at: Date }[]
      >`SELECT id, slug, name, "order", created_at FROM chat_channels ORDER BY "order" ASC`;
      const channels = rows
        .filter((r) =>
          userCanAccessChannel(userId, { type: 'PUBLIC', slug: r.slug, participantIds: null, allowedRoles: undefined }, role)
        )
        .map((r) => ({
          id: r.id,
          slug: r.slug,
          name: r.name,
          order: r.order,
          createdAt: r.created_at,
          type: 'PUBLIC' as const,
        }));
      try {
        const enriched = await enrichChannelsWithUnread(userId, channels);
        return res.json(enriched);
      } catch (err) {
        console.error('[Chat] enrichChannelsWithUnread (legacy path):', err);
        return res.json(
          channels.map((c) => ({
            ...c,
            unreadCount: 0,
            unreadChatCount: 0,
            unreadGalleryCount: 0,
          }))
        );
      }
    } catch (e2) {
      console.error('[Chat] getChannels legacy SQL failed:', e2);
      return res.status(503).json({
        message:
          '채널 목록을 불러오지 못했습니다. DATABASE_URL·DB 연결과 `npx prisma migrate deploy` 적용 여부를 확인해 주세요.',
      });
    }
  }
}

/** 채널 열람 시 미읽음 해제 — body.tab: `chat`(요청) | `gallery`(재요청 첨부) */
export async function markChannelRead(req: AuthRequest, res: Response) {
  const userId = req.user!.id;
  const role = req.user!.role;
  const channelId = req.params.channelId;
  const tab = (req.body as { tab?: string })?.tab === 'gallery' ? 'gallery' : 'chat';
  try {
    const channel = await prisma.chatChannel.findUnique({ where: { id: channelId } });
    if (!channel) {
      res.status(404).json({ message: '채널을 찾을 수 없습니다.' });
      return;
    }
    if (denyIfNoChannelAccess(res, userId, channel, role)) return;

    const now = new Date();
    const data =
      tab === 'gallery'
        ? { lastReadGalleryAt: now }
        : { lastReadAt: now };

    const updated = await prisma.chatChannelRead.updateMany({
      where: { userId, channelId },
      data: data as { lastReadAt?: Date; lastReadGalleryAt?: Date },
    });
    if (updated.count === 0) {
      try {
        await prisma.chatChannelRead.create({
          data:
            tab === 'gallery'
              ? { userId, channelId, lastReadAt: new Date(0), lastReadGalleryAt: now }
              : { userId, channelId, lastReadAt: now, lastReadGalleryAt: null },
        });
      } catch (createErr: unknown) {
        const code = (createErr as { code?: string })?.code;
        if (code === 'P2002') {
          await prisma.chatChannelRead.updateMany({
            where: { userId, channelId },
            data: data as { lastReadAt?: Date; lastReadGalleryAt?: Date },
          });
        } else {
          throw createErr;
        }
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[Chat] markChannelRead failed:', err);
    res.status(500).json({ message: '읽음 처리에 실패했습니다.' });
  }
}

export async function getOrCreateDmChannel(req: AuthRequest, res: Response) {
  const otherUserId = (req.body?.otherUserId || req.query?.otherUserId) as string;
  if (!otherUserId) {
    res.status(400).json({ message: 'otherUserId가 필요합니다.' });
    return;
  }
  const userId = req.user!.id;
  if (otherUserId === userId) {
    res.status(400).json({ message: '자기 자신에게 DM을 보낼 수 없습니다.' });
    return;
  }
  const other = await prisma.user.findUnique({
    where: { id: otherUserId },
    include: { profile: true },
  });
  if (!other || !other.isActive) {
    res.status(404).json({ message: '대상을 찾을 수 없습니다.' });
    return;
  }
  if (other.role !== 'DESIGNER' && other.role !== 'FOREIGN_FREELANCER') {
    res.status(403).json({ message: '디자이너·외국 프리랜서에게만 DM을 보낼 수 있습니다.' });
    return;
  }
  const ids = [userId, otherUserId].sort();
  const slug = `dm-${ids[0]}-${ids[1]}`;
  const otherName = (other.profile as { name?: string } | null)?.name || other.email;
  let channel = await prisma.chatChannel.findUnique({ where: { slug } });
  if (!channel) {
    try {
      channel = await prisma.chatChannel.create({
        data: {
          slug,
          name: `${otherName} (DM)`,
          order: 999,
          type: 'DM' as const,
          participantIds: ids,
        } as any,
      });
    } catch {
      // 마이그레이션 미적용 시 type/participant_ids 컬럼 없음 → raw insert로 기본 컬럼만 사용
      const id = randomUUID();
      await prisma.$executeRaw`INSERT INTO chat_channels (id, slug, name, "order", created_at) VALUES (${id}, ${slug}, ${`${otherName} (DM)`}, 999, NOW())`;
      const [row] = await prisma.$queryRaw<
        { id: string; slug: string; name: string; order: number; created_at: Date }[]
      >`SELECT id, slug, name, "order", created_at FROM chat_channels WHERE slug = ${slug} LIMIT 1`;
      if (!row) {
        res.status(503).json({ message: 'DM 채널 생성에 실패했습니다. DB 마이그레이션을 적용해 주세요.' });
        return;
      }
      channel = { ...row, type: 'PUBLIC', participantIds: null, createdAt: row.created_at } as any;
    }
  }
  res.json(channel);
}

export async function getTaggableUsers(req: AuthRequest, res: Response) {
  const role = req.user!.role;
  const channelId = typeof req.query.channelId === 'string' ? req.query.channelId.trim() : '';
  let slug = '';
  if (channelId) {
    const ch = await prisma.chatChannel.findUnique({
      where: { id: channelId },
      select: { slug: true },
    });
    slug = ch?.slug ?? '';
  }
  const mentionAllInChannel = slug && SPORT_CHAT_SLUGS.has(slug);

  if (mentionAllInChannel) {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        email: true,
        profile: { select: { name: true } },
      },
      orderBy: { email: 'asc' },
    });
    const list = users.map((u) => ({
      id: u.id,
      name: (u.profile as { name?: string } | null)?.name || u.email,
    }));
    res.json(list);
    return;
  }

  if (role !== 'DESIGNER' && role !== 'FOREIGN_FREELANCER') {
    res.json([]);
    return;
  }
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ['DESIGNER', 'FOREIGN_FREELANCER'] },
    },
    select: {
      id: true,
      email: true,
      profile: { select: { name: true } },
    },
  });
  const list = users.map((u) => ({
    id: u.id,
    name: (u.profile as { name?: string } | null)?.name || u.email,
  }));
  res.json(list);
}

export async function getMentionedMessages(req: AuthRequest, res: Response) {
  try {
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(parseInt(String(req.query.limit || 30), 10) || 30, 100);
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    const myName = (user?.profile as { name?: string } | null)?.name || user?.email || '';
    if (!myName) {
      res.json({ messages: [], nextCursor: null });
      return;
    }

    const all = await prisma.chatMessage.findMany({
      take: limit * 10,
      orderBy: { createdAt: 'desc' },
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      include: {
        channel: true,
        user: { include: { profile: true } },
        attachments: chatAttachmentsOrdered,
        reactions: { include: { user: { include: { profile: true } } } },
      },
    });

    const role = req.user!.role;
    const tagged = all
      .filter((m) => {
        const tags = m.tags as string[] | null;
        if (!Array.isArray(tags)) return false;
        return tags.some((t) => t === myName || t.trim() === myName);
      })
      .filter((m) => m.channel && userCanAccessChannel(userId, m.channel, role));
    const items = tagged.slice(0, limit);
    const nextCursor = tagged.length > limit ? items[items.length - 1]?.id : null;

    res.json({
      messages: items.reverse(),
      nextCursor,
    });
  } catch (err) {
    console.error('[Chat] getMentionedMessages error:', err);
    res.json({ messages: [], nextCursor: null });
  }
}

export async function getMessages(req: AuthRequest, res: Response) {
  const channelId = req.params.channelId;
  const cursor = req.query.cursor as string | undefined;
  const limit = Math.min(parseInt(String(req.query.limit || 30), 10) || 30, 100);

  const channel = await prisma.chatChannel.findUnique({ where: { id: channelId } });
  if (!channel) {
    res.status(404).json({ message: '채널을 찾을 수 없습니다.' });
    return;
  }
  if (denyIfNoChannelAccess(res, req.user!.id, channel, req.user!.role)) return;

  const designNotifyFilter = req.query.designNotifyFilter as string | undefined;
  const draftNotifyFilter = req.query.draftNotifyFilter as string | undefined;
  const isDesignNotify = channel.slug.startsWith('design-notify-');
  const isDraftNotify = channel.slug.startsWith('draft-notify-');

  let where: { channelId: string } & Record<string, unknown>;

  if (isDesignNotify && designNotifyFilter === 'newRequest') {
    where = {
      channelId,
      OR: [
        { content: { startsWith: DESIGN_NOTIFY_MSG_PREFIX_NEW } },
        { content: { startsWith: DESIGN_NOTIFY_MSG_PREFIX_INITIAL_EDIT } },
      ],
    };
  } else if (isDesignNotify && designNotifyFilter === 'reRequest') {
    where = {
      channelId,
      OR: [
        { content: { startsWith: DESIGN_NOTIFY_MSG_PREFIX_RE_REQUEST } },
        { content: { startsWith: DESIGN_NOTIFY_MSG_PREFIX_RE_REQUEST_EDIT } },
      ],
    };
  } else if (isDraftNotify && draftNotifyFilter === 'reRequest') {
    where = {
      channelId,
      OR: [
        { content: { startsWith: DRAFT_NOTIFY_MSG_PREFIX_RE_REQUEST } },
        { content: { startsWith: DESIGN_REPLY_COMPLETE_RE_REQUEST_MSG_PREFIX } },
      ],
    };
  } else if (isDraftNotify) {
    /** 시안 알림 탭: 요청 코멘트·완료만. draftNotifyFilter 미전달(채널 로딩 직후 등)에도 재요청 코멘트가 섞이지 않게 전체 채널 조회를 쓰지 않음 */
    where = {
      channelId,
      AND: [
        {
          OR: [
            { content: { startsWith: DRAFT_NOTIFY_MSG_PREFIX_COMMENT } },
            { content: { startsWith: DESIGN_REPLY_COMPLETE_MSG_PREFIX } },
          ],
        },
        { NOT: { content: { startsWith: DRAFT_NOTIFY_MSG_PREFIX_RE_REQUEST } } },
      ],
    };
  } else {
    where = { channelId };
  }
  const messages = await prisma.chatMessage.findMany({
    where,
    take: limit + 1,
    orderBy: { createdAt: 'desc' },
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    include: {
      user: { include: { profile: true } },
      attachments: chatAttachmentsOrdered,
      reactions: { include: { user: { include: { profile: true } } } },
      parentMessage: {
        include: {
          user: { include: { profile: true } },
          attachments: chatAttachmentsOrdered,
        },
      },
    } as any,
  });

  const hasMore = messages.length > limit;
  const items = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = hasMore ? items[0].id : null;

  res.json({
    messages: items.reverse(),
    nextCursor,
  });
}

export async function searchMessages(req: AuthRequest, res: Response) {
  const channelId = req.params.channelId;
  const q = (req.query.q as string)?.trim();
  if (!q || q.length < 2) {
    res.json({ messages: [] });
    return;
  }

  const channel = await prisma.chatChannel.findUnique({ where: { id: channelId } });
  if (!channel) {
    res.status(404).json({ message: '채널을 찾을 수 없습니다.' });
    return;
  }
  if (denyIfNoChannelAccess(res, req.user!.id, channel, req.user!.role)) return;

  const messages = await prisma.chatMessage.findMany({
    where: {
      channelId,
      OR: [
        { content: { contains: q, mode: 'insensitive' } },
        { translatedContent: { contains: q, mode: 'insensitive' } },
      ],
    },
    take: 50,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { include: { profile: true } },
      attachments: chatAttachmentsOrdered,
      reactions: { include: { user: { include: { profile: true } } } },
      parentMessage: {
        include: {
          user: { include: { profile: true } },
          attachments: chatAttachmentsOrdered,
        },
      },
    } as any,
  });
  res.json({ messages: messages.reverse() });
}

export async function getChannelAttachments(req: AuthRequest, res: Response) {
  const channelId = req.params.channelId;
  const channel = await prisma.chatChannel.findUnique({ where: { id: channelId } });
  if (!channel) {
    res.status(404).json({ message: '채널을 찾을 수 없습니다.' });
    return;
  }
  if (denyIfNoChannelAccess(res, req.user!.id, channel, req.user!.role)) return;

  const attachments = await prisma.chatAttachment.findMany({
    where: { message: { channelId } },
    include: {
      message: {
        select: {
          id: true,
          content: true,
          createdAt: true,
          user: { select: { id: true, email: true, profile: { select: { name: true } } } },
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { sortOrder: 'asc' }] as any,
    take: 200,
  });
  res.json({ attachments });
}

export async function createMessage(req: AuthRequest, res: Response) {
  const channelId = req.params.channelId;
  const parsed = createMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: '잘못된 요청입니다.', errors: parsed.error.flatten() });
    return;
  }

  const channel = await prisma.chatChannel.findUnique({ where: { id: channelId } });
  if (!channel) {
    res.status(404).json({ message: '채널을 찾을 수 없습니다.' });
    return;
  }
  if (denyIfNoChannelAccess(res, req.user!.id, channel, req.user!.role)) return;

  const { content, translatedContent, tags, attachmentKeys, parentMessageId } = parsed.data;

  const canUseMentions =
    SPORT_CHAT_SLUGS.has(channel.slug) ||
    req.user!.role === 'DESIGNER' ||
    req.user!.role === 'FOREIGN_FREELANCER';
  if (tags.length > 0 && !canUseMentions) {
    res.status(403).json({ message: '멘션은 디자이너·해외 디자이너만 사용할 수 있습니다.' });
    return;
  }

  let finalTags = [...tags];

  if (parentMessageId) {
    const parentMsg = await prisma.chatMessage.findUnique({
      where: { id: parentMessageId },
      include: { user: { include: { profile: true } } },
    });
    if (!parentMsg || parentMsg.channelId !== channelId) {
      res.status(400).json({ message: '답글 대상 메시지를 찾을 수 없습니다.' });
      return;
    }
    // 원본 작성자가 본인이 아닌 경우, 자동으로 멘션 태그 추가 → 🔔 알림 전달
    if (parentMsg.userId !== req.user!.id) {
      const parentAuthorName = (parentMsg.user?.profile as { name?: string } | null)?.name || parentMsg.user?.email || '';
      if (parentAuthorName && !finalTags.includes(parentAuthorName)) {
        finalTags = [parentAuthorName, ...finalTags];
      }
    }
  }

  const message = await prisma.chatMessage.create({
    data: {
      channelId,
      userId: req.user!.id,
      content,
      translatedContent: translatedContent || undefined,
      tags: finalTags.length ? finalTags : undefined,
      parentMessageId: parentMessageId || undefined,
      attachments: {
        create: attachmentKeys.map((a, i) => ({
          s3Key: a.s3Key,
          filename: a.filename,
          mimeType: a.mimeType,
          size: a.size,
          sortOrder: i,
        })),
      },
    } as any,
    include: {
      user: { include: { profile: true } },
      attachments: chatAttachmentsOrdered,
      reactions: { include: { user: { include: { profile: true } } } },
      parentMessage: {
        include: {
          user: { include: { profile: true } },
          attachments: chatAttachmentsOrdered,
        },
      },
    } as any,
  });

  res.status(201).json(message);
}

const updateMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  translatedContent: z.string().max(10000).optional().nullable(),
});

export async function updateMessage(req: AuthRequest, res: Response) {
  const { channelId, messageId } = req.params;
  const parsed = updateMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: '잘못된 요청입니다.', errors: parsed.error.flatten() });
    return;
  }

  const channel = await prisma.chatChannel.findUnique({ where: { id: channelId } });
  if (!channel) {
    res.status(404).json({ message: '채널을 찾을 수 없습니다.' });
    return;
  }
  if (denyIfNoChannelAccess(res, req.user!.id, channel, req.user!.role)) return;

  const msg = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!msg || msg.channelId !== channelId) {
    res.status(404).json({ message: '메시지를 찾을 수 없습니다.' });
    return;
  }
  if (msg.userId !== req.user!.id) {
    res.status(403).json({ message: '본인 메시지만 수정할 수 있습니다.' });
    return;
  }

  const updateData: { content: string; translatedContent?: string | null } = {
    content: parsed.data.content,
  };
  if (parsed.data.translatedContent !== undefined) {
    updateData.translatedContent = parsed.data.translatedContent || null;
  }
  const updated = await prisma.chatMessage.update({
    where: { id: messageId },
    data: updateData,
    include: {
      user: { include: { profile: true } },
      attachments: chatAttachmentsOrdered,
      reactions: { include: { user: { include: { profile: true } } } },
    },
  });
  res.json(updated);
}

export async function deleteMessage(req: AuthRequest, res: Response) {
  const { channelId, messageId } = req.params;
  const channel = await prisma.chatChannel.findUnique({ where: { id: channelId } });
  if (!channel) {
    res.status(404).json({ message: '채널을 찾을 수 없습니다.' });
    return;
  }
  if (denyIfNoChannelAccess(res, req.user!.id, channel, req.user!.role)) return;

  const msg = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    include: { attachments: chatAttachmentsOrdered },
  });
  if (!msg || msg.channelId !== channelId) {
    res.status(404).json({ message: '메시지를 찾을 수 없습니다.' });
    return;
  }
  if (msg.userId !== req.user!.id) {
    res.status(403).json({ message: '본인 메시지만 삭제할 수 있습니다.' });
    return;
  }

  // S3 파일 삭제
  for (const att of msg.attachments) {
    await deleteS3Object(att.s3Key);
  }

  await prisma.chatMessage.delete({ where: { id: messageId } });
  res.status(204).send();
}

const reactionSchema = z.object({ emoji: z.string().min(1).max(20) });

export async function addReaction(req: AuthRequest, res: Response) {
  const { messageId } = req.params;
  const parsed = reactionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'emoji가 필요합니다.' });
    return;
  }

  const msg = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    include: { channel: true },
  });
  if (!msg) {
    res.status(404).json({ message: '메시지를 찾을 수 없습니다.' });
    return;
  }
  if (denyIfNoChannelAccess(res, req.user!.id, msg.channel, req.user!.role)) return;

  const reaction = await prisma.chatMessageReaction.upsert({
    where: {
      messageId_userId_emoji: {
        messageId,
        userId: req.user!.id,
        emoji: parsed.data.emoji,
      },
    },
    create: {
      messageId,
      userId: req.user!.id,
      emoji: parsed.data.emoji,
    },
    update: {},
    include: { user: { include: { profile: true } } },
  });
  res.status(201).json(reaction);
}

export async function removeReaction(req: AuthRequest, res: Response) {
  const { messageId, emoji } = req.params;
  const msg = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    include: { channel: true },
  });
  if (!msg) {
    res.status(404).json({ message: '메시지를 찾을 수 없습니다.' });
    return;
  }
  if (denyIfNoChannelAccess(res, req.user!.id, msg.channel, req.user!.role)) return;

  await prisma.chatMessageReaction.deleteMany({
    where: { messageId, userId: req.user!.id, emoji },
  });
  res.status(204).send();
}

export async function getUploadUrl(req: AuthRequest, res: Response) {
  const filename = req.body.filename ?? req.query.filename;
  const mimeType = req.body.mimeType ?? req.query.mimeType ?? 'application/octet-stream';

  if (!filename) {
    res.status(400).json({ message: 'filename이 필요합니다.' });
    return;
  }

  const result = await getPresignedUploadUrl(
    String(filename),
    String(mimeType),
    req.user!.id
  );
  if (!result) {
    res.status(503).json({
      message: '파일 업로드 기능을 사용할 수 없습니다. AWS 설정을 확인하세요.',
      uploadUrl: null,
      s3Key: null,
    });
    return;
  }

  res.json(result);
}

const patchChannelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  allowedRoles: z
    .array(
      z.enum(['EMPLOYEE', 'PLANNING', 'MANAGER', 'SUPER_ADMIN', 'CS', 'DESIGNER', 'FOREIGN_FREELANCER'])
    )
    .nullable()
    .optional(),
});

/** 대표만: 공개 채널 이름·열람 역할 수정 (DM 불가) */
export async function patchChannel(req: AuthRequest, res: Response) {
  if (req.user!.role !== 'SUPER_ADMIN') {
    res.status(403).json({ message: '대표만 채널 설정을 변경할 수 있습니다.' });
    return;
  }
  const channelId = req.params.channelId;
  const parsed = patchChannelSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: '잘못된 요청입니다.', errors: parsed.error.flatten() });
    return;
  }
  const existing = await prisma.chatChannel.findUnique({ where: { id: channelId } });
  if (!existing) {
    res.status(404).json({ message: '채널을 찾을 수 없습니다.' });
    return;
  }
  if (existing.type === 'DM') {
    res.status(400).json({ message: 'DM 채널은 설정을 변경할 수 없습니다.' });
    return;
  }
  const { name, allowedRoles } = parsed.data;
  const data: { name?: string; allowedRoles?: unknown } = {};
  if (name !== undefined) data.name = name;
  if (allowedRoles !== undefined) {
    data.allowedRoles = allowedRoles === null || allowedRoles.length === 0 ? null : allowedRoles;
  }
  if (Object.keys(data).length === 0) {
    res.status(400).json({ message: '변경할 항목이 없습니다.' });
    return;
  }
  const updated = await prisma.chatChannel.update({
    where: { id: channelId },
    data: data as any,
  });
  res.json({
    id: updated.id,
    slug: updated.slug,
    name: updated.name,
    order: updated.order,
    allowedRoles: (updated as { allowedRoles?: unknown }).allowedRoles,
    type: updated.type,
  });
}

export async function translateMessage(req: AuthRequest, res: Response) {
  const parsed = translateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: '잘못된 요청입니다.', errors: parsed.error.flatten() });
    return;
  }

  const { text, fromLang, toLang } = parsed.data;
  if (fromLang === toLang) {
    res.json({ translated: text });
    return;
  }

  try {
    const translated = await translate(text, fromLang, toLang);
    res.json({ translated });
  } catch (err: unknown) {
    console.error('[Chat] Translation error:', err);
    let msg = '번역에 실패했습니다.';
    if (err instanceof Error) msg = err.message;
    if (typeof (err as any)?.message === 'string') msg = (err as any).message;
    res.status(500).json({ message: msg });
  }
}

export async function getDownloadUrl(req: AuthRequest, res: Response) {
  const attachmentId = req.params.attachmentId;
  const att = await prisma.chatAttachment.findUnique({
    where: { id: attachmentId },
    include: { message: { include: { channel: true } } },
  });
  if (!att) {
    res.status(404).json({ message: '첨부파일을 찾을 수 없습니다.' });
    return;
  }
  if (denyIfNoChannelAccess(res, req.user!.id, att.message.channel, req.user!.role)) return;
  const url = await getPresignedDownloadUrl(att.s3Key, att.filename);
  if (!url) {
    res.status(503).json({ message: '다운로드 URL을 생성할 수 없습니다. AWS 설정을 확인하세요.' });
    return;
  }
  res.json({ downloadUrl: url, filename: att.filename });
}
