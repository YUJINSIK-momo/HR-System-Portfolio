import prisma from '../lib/prisma';
import { extractMentionTagsFromContent } from '../utils/extractMentionTags';

type DesignRequestSport = 'SOCCER' | 'BASKETBALL' | 'BASEBALL' | 'BASEBALL_HOF' | 'VOLLEYBALL';

/** 채널 목록·메시지 헤더와 맞춤 — 프론트 `DESIGN_SPORT_TAB_EMOJI`와 동일 */
const SPORT_CHANNEL_EMOJI: Record<DesignRequestSport, string> = {
  SOCCER: '⚽',
  BASKETBALL: '🏀',
  BASEBALL: '⚾',
  BASEBALL_HOF: '⚾',
  VOLLEYBALL: '🏐',
};

function frontendBaseUrl(): string {
  return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
}

/** 팀 디자인 상세 URL. `replyId`가 있으면 해당 답변 카드로 스크롤 */
export function teamDesignDetailUrl(requestId: string, replyId?: string | null): string {
  const path = `${frontendBaseUrl()}/team-design/${requestId}`;
  const rid = replyId?.trim();
  if (!rid) return path;
  const u = new URL(path);
  u.searchParams.set('reply', rid);
  return u.toString();
}

/** design-notify-* 채팅 필터·미읽음 집계용 */
export const DESIGN_NOTIFY_MSG_PREFIX_NEW = '🎨 [디자인 요청]';
export const DESIGN_NOTIFY_MSG_PREFIX_INITIAL_EDIT = '✏️ [초기 요청 수정]';
export const DESIGN_NOTIFY_MSG_PREFIX_RE_REQUEST = '🔄 [재요청';
export const DESIGN_NOTIFY_MSG_PREFIX_RE_REQUEST_EDIT = '✏️ [재요청 수정]';
/** 우선제작만 변경했을 때 채팅 알림 접두사 (재요청 수정과 구분) */
export const DESIGN_NOTIFY_MSG_PREFIX_PRIORITY_TARGET = '⭐ [우선제작]';

/** draft-notify-* 코멘트 알림 본문 접두사 */
export const DRAFT_NOTIFY_MSG_PREFIX_COMMENT = '💬 [요청 코멘트]';
export const DRAFT_NOTIFY_MSG_PREFIX_RE_REQUEST = '💬 [재요청 코멘트]';
export const DESIGN_REPLY_COMPLETE_MSG_PREFIX = '✅ [디자인 시안 완료]';
/** 재요청 블록 안에서 디자이너 완료 멘션 — 재요청 시안 알림 탭에만 표시 */
export const DESIGN_REPLY_COMPLETE_RE_REQUEST_MSG_PREFIX = '✅ [재요청 시안 완료]';

/** 축구 디자인 요청 알림 등 — 디자이너·해외 디자이너·관리자·대표 (신규 요청·재요청 자동 알림). CS는 제외 */
export const DESIGN_REQUEST_NOTIFY_ALLOWED_ROLES = [
  'MANAGER',
  'SUPER_ADMIN',
  'DESIGNER',
  'FOREIGN_FREELANCER',
] as const;
/** 축구 시안 알림 등 — CS·관리자·대표 (요청/재요청 코멘트·시안 완료 멘션) */
export const DRAFT_NOTIFY_ALLOWED_ROLES = ['CS', 'MANAGER', 'SUPER_ADMIN'] as const;

export const DESIGN_NOTIFY_CHANNEL_SLUG: Record<DesignRequestSport, string> = {
  SOCCER: 'design-notify-soccer',
  BASKETBALL: 'design-notify-basketball',
  BASEBALL: 'design-notify-baseball',
  BASEBALL_HOF: 'design-notify-baseball-hof',
  VOLLEYBALL: 'design-notify-volleyball',
};

export const DRAFT_NOTIFY_CHANNEL_SLUG: Record<DesignRequestSport, string> = {
  SOCCER: 'draft-notify-soccer',
  BASKETBALL: 'draft-notify-basketball',
  BASEBALL: 'draft-notify-baseball',
  BASEBALL_HOF: 'draft-notify-baseball-hof',
  VOLLEYBALL: 'draft-notify-volleyball',
};

const REQUEST_META: Record<DesignRequestSport, { name: string; order: number }> = {
  SOCCER: { name: `${SPORT_CHANNEL_EMOJI.SOCCER} 축구 디자인 요청 알림`, order: 100 },
  BASKETBALL: { name: `${SPORT_CHANNEL_EMOJI.BASKETBALL} 농구 디자인 요청 알림`, order: 101 },
  BASEBALL: { name: `${SPORT_CHANNEL_EMOJI.BASEBALL} 야구 디자인 요청 알림`, order: 102 },
  BASEBALL_HOF: { name: `${SPORT_CHANNEL_EMOJI.BASEBALL_HOF} 야구(HOF) 디자인 요청 알림`, order: 103 },
  VOLLEYBALL: { name: `${SPORT_CHANNEL_EMOJI.VOLLEYBALL} 배구 디자인 요청 알림`, order: 104 },
};

const DRAFT_META: Record<DesignRequestSport, { name: string; order: number }> = {
  SOCCER: { name: `${SPORT_CHANNEL_EMOJI.SOCCER} 축구 시안 알림`, order: 110 },
  BASKETBALL: { name: `${SPORT_CHANNEL_EMOJI.BASKETBALL} 농구 시안 알림`, order: 111 },
  BASEBALL: { name: `${SPORT_CHANNEL_EMOJI.BASEBALL} 야구 시안 알림`, order: 112 },
  BASEBALL_HOF: { name: `${SPORT_CHANNEL_EMOJI.BASEBALL_HOF} 야구(HOF) 시안 알림`, order: 113 },
  VOLLEYBALL: { name: `${SPORT_CHANNEL_EMOJI.VOLLEYBALL} 배구 시안 알림`, order: 114 },
};

const SPORTS_ORDERED: DesignRequestSport[] = ['SOCCER', 'BASKETBALL', 'BASEBALL', 'BASEBALL_HOF', 'VOLLEYBALL'];

export async function ensureDesignNotificationChannels(): Promise<void> {
  for (const sport of SPORTS_ORDERED) {
    const { name, order } = REQUEST_META[sport];
    const slug = DESIGN_NOTIFY_CHANNEL_SLUG[sport];
    await prisma.chatChannel.upsert({
      where: { slug },
      create: {
        slug,
        name,
        order,
        type: 'PUBLIC',
        allowedRoles: [...DESIGN_REQUEST_NOTIFY_ALLOWED_ROLES],
      } as any,
      update: {
        name,
        allowedRoles: [...DESIGN_REQUEST_NOTIFY_ALLOWED_ROLES],
      } as any,
    });
  }
}

export async function ensureDraftNotificationChannels(): Promise<void> {
  for (const sport of SPORTS_ORDERED) {
    const { name, order } = DRAFT_META[sport];
    const slug = DRAFT_NOTIFY_CHANNEL_SLUG[sport];
    await prisma.chatChannel.upsert({
      where: { slug },
      create: {
        slug,
        name,
        order,
        type: 'PUBLIC',
        allowedRoles: [...DRAFT_NOTIFY_ALLOWED_ROLES],
      } as any,
      update: {
        name,
        allowedRoles: [...DRAFT_NOTIFY_ALLOWED_ROLES],
      } as any,
    });
  }
}

export function sportLabel(s: DesignRequestSport): string {
  if (s === 'SOCCER') return '축구';
  if (s === 'BASKETBALL') return '농구';
  if (s === 'BASEBALL') return '야구';
  if (s === 'BASEBALL_HOF') return '야구(HOF)';
  return '배구';
}

async function requesterDisplayName(userId: string): Promise<string | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, profile: { select: { name: true } } },
  });
  if (!u) return null;
  return (u.profile?.name?.trim() || u.email).trim();
}

function mergeMentionTags(...names: (string | null | undefined)[]): string[] {
  const s = new Set<string>();
  for (const n of names) {
    const t = n?.trim();
    if (t) s.add(t);
  }
  return Array.from(s).slice(0, 20);
}

/** 디자이너·해외 디자이너 답변에 @맨션이 있으면 시안 알림 채널에 게시. 멘션이 없으면 false */
export async function postDesignReplyCompletionMentionNotifications(params: {
  designRequestId: string;
  /** 시안 알림 상세 링크 앵커 */
  replyId: string;
  requesterId: string;
  teamName: string;
  product: string;
  sport: DesignRequestSport;
  replyContent: string;
  authorUserId: string;
  /** true: 재요청 블록 안에서 단 코멘트 → 재요청 시안 알림 탭에만 표시 */
  inReRequestBlock?: boolean;
}): Promise<boolean> {
  const text = params.replyContent.trim();
  if (!text) return false;

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { email: true, profile: { select: { name: true } } },
  });
  const knownNames = users
    .map((u) => (u.profile?.name?.trim() || u.email).trim())
    .filter(Boolean);
  const contentTags = extractMentionTagsFromContent(text, knownNames);
  if (contentTags.length === 0) return false;

  const requesterName = await requesterDisplayName(params.requesterId);
  const tags = mergeMentionTags(requesterName, ...contentTags);

  await ensureDraftNotificationChannels();
  const slug = DRAFT_NOTIFY_CHANNEL_SLUG[params.sport];
  const channel = await prisma.chatChannel.findUnique({ where: { slug } });
  if (!channel) return false;

  const detailUrl = teamDesignDetailUrl(params.designRequestId, params.replyId);
  const mentionLine = contentTags.map((t) => `@${t}`).join(' ');
  const regLine = requesterName ? `등록자: @${requesterName}` : '';
  const headPrefix = params.inReRequestBlock
    ? DESIGN_REPLY_COMPLETE_RE_REQUEST_MSG_PREFIX
    : DESIGN_REPLY_COMPLETE_MSG_PREFIX;
  const lines = [
    `${headPrefix} ${sportLabel(params.sport)}`,
    `팀명: ${params.teamName}`,
    `상품: ${params.product}`,
    ...(regLine ? [regLine] : []),
    '요청하신 시안 작업이 완료되었습니다.',
    mentionLine,
    '',
    `상세보기: ${detailUrl}`,
  ];

  await prisma.chatMessage.create({
    data: {
      channelId: channel.id,
      userId: params.authorUserId,
      content: lines.join('\n'),
      tags,
    },
  });
  return true;
}

/** 시안 알림: 일반 요청 코멘트(COMMENT) */
export async function postDraftNotifyRequestComment(params: {
  sport: DesignRequestSport;
  requestId: string;
  replyId: string;
  requesterId: string;
  teamName: string;
  product: string;
  contentSummary: string;
  userId: string;
}): Promise<void> {
  await ensureDraftNotificationChannels();
  const slug = DRAFT_NOTIFY_CHANNEL_SLUG[params.sport];
  const channel = await prisma.chatChannel.findUnique({ where: { slug } });
  if (!channel) return;

  const requesterName = await requesterDisplayName(params.requesterId);
  const tags = mergeMentionTags(requesterName);

  const detailUrl = teamDesignDetailUrl(params.requestId, params.replyId);
  const raw = params.contentSummary.trim();
  const summary =
    raw.length > 200 ? `${raw.slice(0, 200)}…` : raw || '(첨부만)';

  const regLine = requesterName ? `등록자: @${requesterName}` : '';
  const lines = [
    `${DRAFT_NOTIFY_MSG_PREFIX_COMMENT} ${sportLabel(params.sport)}`,
    `팀명: ${params.teamName}`,
    `상품: ${params.product}`,
    ...(regLine ? [regLine] : []),
    `내용: ${summary}`,
    '',
    `상세보기: ${detailUrl}`,
  ];

  await prisma.chatMessage.create({
    data: {
      channelId: channel.id,
      userId: params.userId,
      content: lines.join('\n'),
      tags: tags.length ? tags : undefined,
    },
  });
}

/** 시안 알림·재요청 탭: 재요청 블록 **안**에 달린 COMMENT만 (RE_REQUEST 등록 시점이 아님) */
export async function postDraftNotifyReRequestComment(params: {
  sport: DesignRequestSport;
  requestId: string;
  replyId: string;
  requesterId: string;
  teamName: string;
  product: string;
  content: string;
  reRequestNumber: number;
  userId: string;
}): Promise<void> {
  await ensureDraftNotificationChannels();
  const slug = DRAFT_NOTIFY_CHANNEL_SLUG[params.sport];
  const channel = await prisma.chatChannel.findUnique({ where: { slug } });
  if (!channel) return;

  const requesterName = await requesterDisplayName(params.requesterId);
  const tags = mergeMentionTags(requesterName);

  const detailUrl = teamDesignDetailUrl(params.requestId, params.replyId);
  const summary =
    params.content.length > 200 ? `${params.content.slice(0, 200)}…` : params.content;

  const regLine = requesterName ? `등록자: @${requesterName}` : '';
  const lines = [
    `${DRAFT_NOTIFY_MSG_PREFIX_RE_REQUEST} #${params.reRequestNumber} ${sportLabel(params.sport)}`,
    `팀명: ${params.teamName}`,
    `상품: ${params.product}`,
    ...(regLine ? [regLine] : []),
    `재요청 내용: ${summary}`,
    '',
    `상세보기: ${detailUrl}`,
  ];

  await prisma.chatMessage.create({
    data: {
      channelId: channel.id,
      userId: params.userId,
      content: lines.join('\n'),
      tags: tags.length ? tags : undefined,
    },
  });
}

export async function postDesignRequestChatNotification(params: {
  sport: DesignRequestSport;
  requestId: string;
  teamName: string;
  product: string;
  initialRequest: string;
  userId: string;
}): Promise<void> {
  await ensureDesignNotificationChannels();
  const slug = DESIGN_NOTIFY_CHANNEL_SLUG[params.sport];
  const channel = await prisma.chatChannel.findUnique({ where: { slug } });
  if (!channel) return;

  const detailUrl = teamDesignDetailUrl(params.requestId);
  const summary =
    params.initialRequest.length > 200 ? `${params.initialRequest.slice(0, 200)}…` : params.initialRequest;

  const lines = [
    `${DESIGN_NOTIFY_MSG_PREFIX_NEW} ${sportLabel(params.sport)}`,
    `팀명: ${params.teamName}`,
    `상품: ${params.product}`,
    `요청: ${summary}`,
    '',
    `상세보기: ${detailUrl}`,
  ];

  await prisma.chatMessage.create({
    data: {
      channelId: channel.id,
      userId: params.userId,
      content: lines.join('\n'),
    },
  });
}

/** 초기 요청 본문 수정 시 — design-notify-* (신규 요청과 동일 채널) */
export async function postDesignInitialRequestEditNotification(params: {
  sport: DesignRequestSport;
  requestId: string;
  teamName: string;
  product: string;
  initialRequest: string;
  userId: string;
  /**
   * 무엇이 바뀌었는지(예: `첨부` 또는 `요청 본문, 첨부`).
   * 팀명·상품은 본문 위에 따로 있어 메타 묶음은 넣지 않음.
   */
  changePartsLabel?: string;
  /** false면 본문은 이번 편집에서 바꾸지 않았고, 아래 줄은 `수정 내용:`으로 표시(현재 저장된 본문) */
  bodyWasPatched?: boolean;
  /** true면 우선제작만 바뀐 경우 — `초기 요청 수정` 대신 우선제작 알림 */
  priorityTargetOnly?: boolean;
  /** priorityTargetOnly일 때 적용 여부 */
  priorityFirstOn?: boolean;
}): Promise<void> {
  await ensureDesignNotificationChannels();
  const slug = DESIGN_NOTIFY_CHANNEL_SLUG[params.sport];
  const channel = await prisma.chatChannel.findUnique({ where: { slug } });
  if (!channel) {
    console.warn(`[designRequestNotify] initial edit: channel not found slug=${slug}`);
    return;
  }

  const detailUrl = teamDesignDetailUrl(params.requestId);

  if (params.priorityTargetOnly) {
    const on = params.priorityFirstOn !== false;
    const lines = [
      `${DESIGN_NOTIFY_MSG_PREFIX_PRIORITY_TARGET} ${sportLabel(params.sport)}`,
      `팀명: ${params.teamName}`,
      `상품: ${params.product}`,
      `우선제작: ${on ? '대상' : '해제'}`,
      '',
      `상세보기: ${detailUrl}`,
    ];
    await prisma.chatMessage.create({
      data: {
        channelId: channel.id,
        userId: params.userId,
        content: lines.join('\n'),
      },
    });
    return;
  }
  const summary =
    params.initialRequest.length > 200 ? `${params.initialRequest.slice(0, 200)}…` : params.initialRequest;

  const bodyWasPatched = params.bodyWasPatched !== false;
  const requestLineLabel = bodyWasPatched ? '수정된 요청' : '수정 내용';

  const lines = [
    `${DESIGN_NOTIFY_MSG_PREFIX_INITIAL_EDIT} ${sportLabel(params.sport)}`,
    `팀명: ${params.teamName}`,
    `상품: ${params.product}`,
    ...(params.changePartsLabel ? [`변경: ${params.changePartsLabel}`] : []),
    `${requestLineLabel}: ${summary}`,
    '',
    `상세보기: ${detailUrl}`,
  ];

  await prisma.chatMessage.create({
    data: {
      channelId: channel.id,
      userId: params.userId,
      content: lines.join('\n'),
    },
  });
}

export async function postDesignReRequestChatNotification(params: {
  sport: DesignRequestSport;
  requestId: string;
  replyId: string;
  teamName: string;
  product: string;
  content: string;
  reRequestNumber: number;
  userId: string;
}): Promise<void> {
  await ensureDesignNotificationChannels();
  const slug = DESIGN_NOTIFY_CHANNEL_SLUG[params.sport];
  const channel = await prisma.chatChannel.findUnique({ where: { slug } });
  if (!channel) return;

  const detailUrl = teamDesignDetailUrl(params.requestId, params.replyId);
  const summary =
    params.content.length > 200 ? `${params.content.slice(0, 200)}…` : params.content;

  const lines = [
    `${DESIGN_NOTIFY_MSG_PREFIX_RE_REQUEST} #${params.reRequestNumber}] ${sportLabel(params.sport)}`,
    `팀명: ${params.teamName}`,
    `상품: ${params.product}`,
    `재요청 내용: ${summary}`,
    '',
    `상세보기: ${detailUrl}`,
  ];

  await prisma.chatMessage.create({
    data: {
      channelId: channel.id,
      userId: params.userId,
      content: lines.join('\n'),
    },
  });
}

/** 재요청(RE_REQUEST) 답변 수정 시 — design-notify-* */
export async function postDesignReRequestEditChatNotification(params: {
  sport: DesignRequestSport;
  requestId: string;
  replyId: string;
  teamName: string;
  product: string;
  content: string;
  reRequestNumber: number;
  userId: string;
  /** 본문·첨부 변경 없이 우선제작만 바뀐 경우 — `재요청 수정` 대신 우선제작 알림 */
  priorityOnly?: boolean;
  priorityFirstOn?: boolean;
}): Promise<void> {
  await ensureDesignNotificationChannels();
  const slug = DESIGN_NOTIFY_CHANNEL_SLUG[params.sport];
  const channel = await prisma.chatChannel.findUnique({ where: { slug } });
  if (!channel) {
    console.warn(`[designRequestNotify] re-request edit: channel not found slug=${slug}`);
    return;
  }

  const detailUrl = teamDesignDetailUrl(params.requestId, params.replyId);

  if (params.priorityOnly) {
    const on = params.priorityFirstOn !== false;
    const lines = [
      `${DESIGN_NOTIFY_MSG_PREFIX_PRIORITY_TARGET} #${params.reRequestNumber} ${sportLabel(params.sport)}`,
      `팀명: ${params.teamName}`,
      `상품: ${params.product}`,
      `우선제작: ${on ? '대상' : '해제'}`,
      '',
      `상세보기: ${detailUrl}`,
    ];
    await prisma.chatMessage.create({
      data: {
        channelId: channel.id,
        userId: params.userId,
        content: lines.join('\n'),
      },
    });
    return;
  }

  const summary =
    params.content.length > 200 ? `${params.content.slice(0, 200)}…` : params.content;

  const lines = [
    `${DESIGN_NOTIFY_MSG_PREFIX_RE_REQUEST_EDIT} #${params.reRequestNumber} ${sportLabel(params.sport)}`,
    `팀명: ${params.teamName}`,
    `상품: ${params.product}`,
    `재요청 내용(수정): ${summary}`,
    '',
    `상세보기: ${detailUrl}`,
  ];

  await prisma.chatMessage.create({
    data: {
      channelId: channel.id,
      userId: params.userId,
      content: lines.join('\n'),
    },
  });
}
