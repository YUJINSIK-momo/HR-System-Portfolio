import { Response } from 'express';
import { z } from 'zod';
import prisma, { Prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import {
  buildAttachmentContentDisposition,
  checkS3KeyExists,
  deleteS3Object,
  getObjectBuffer,
  getPresignedDownloadUrl,
  getPresignedUploadUrlForDesign,
} from '../services/s3.service';
import { cropCustomerKeepLeft } from '../services/designReplyCustomerCrop.service';
import {
  postDesignRequestChatNotification,
  postDesignInitialRequestEditNotification,
  postDesignReRequestChatNotification,
  postDesignReRequestEditChatNotification,
  postDesignReplyCompletionMentionNotifications,
  postDraftNotifyRequestComment,
  postDraftNotifyReRequestComment,
} from '../services/designRequestNotify.service';
import { translate } from '../services/translation.service';
import { DESIGN_DASHBOARD_MAX_RANGE_MS } from '../constants/retention';
import { isValidProductForSport } from '../constants/designProducts';
import {
  buildDesignRequestDownloadBaseName,
  designVersionOrdinal,
  withOriginalExtension,
} from '../utils/designDownloadFilename';

function dbUnavailableMessage(e: unknown): string | null {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  if (
    lower.includes('enum') ||
    lower.includes('designrequestsport') ||
    lower.includes('invalid input value for enum')
  ) {
    return [
      'DB enum(종목 등)이 코드와 맞지 않습니다.',
      'backend에서 `npx prisma migrate deploy` 로 최신 마이그레이션을 적용했는지 확인해 주세요.',
      '(야구(HOF) 추가 후 로컬 DB에 반영 안 했으면 동일 오류가 납니다.)',
    ].join(' ');
  }
  if (
    lower.includes('column') &&
    (lower.includes('does not exist') || lower.includes('unknown column'))
  ) {
    return [
      'DB 스키마가 최신이 아닙니다.',
      'backend 폴더에서 `npx prisma migrate deploy` 를 실행해 주세요.',
      '(Supabase 풀러에서 잠금 타임아웃이 나면 Session/Direct URL로 바꿔 재시도해 보세요.)',
    ].join(' ');
  }
  if (
    msg.includes('design_requests') ||
    (msg.includes('does not exist') && msg.toLowerCase().includes('table'))
  ) {
    return [
      '디자인 요청용 테이블이 DB에 아직 없습니다.',
      'PC에서 backend 폴더로 이동한 뒤 `npx prisma migrate deploy` 를 실행해 주세요.',
      '(Supabase 사용 시 같은 오류가 나면 대시보드의 Session/Direct 연결 문자열로 DATABASE_URL을 잠시 바꾼 뒤 다시 시도해 보세요.)',
    ].join(' ');
  }
  if (lower.includes('chat_channel_reads') || (lower.includes('relation') && lower.includes('does not exist'))) {
    return [
      '채팅 읽음 테이블(chat_channel_reads)이 없습니다.',
      'backend에서 `npx prisma migrate deploy` 를 실행해 주세요.',
    ].join(' ');
  }
  return null;
}

const sportSchema = z.enum(['SOCCER', 'BASKETBALL', 'BASEBALL', 'BASEBALL_HOF', 'VOLLEYBALL']);
const productStringSchema = z.string().min(1).max(200);
const statusSchema = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']);
const replyKindSchema = z.enum(['COMMENT', 'DRAFT', 'RE_REQUEST']);

type DesignRequestSport = z.infer<typeof sportSchema>;
type DesignRequestStatus = z.infer<typeof statusSchema>;

const attachmentKeySchema = z.object({
  s3Key: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number().int().positive().max(50 * 1024 * 1024),
});

const versionSchema = z.number().int().min(1).max(20);

const createSchema = z
  .object({
    sport: sportSchema,
    teamName: z.string().min(1).max(200),
    product: productStringSchema,
    version: versionSchema.optional().default(1),
    initialRequest: z.string().min(1).max(10000),
    /** 초기 요청 원문이 한국어인지 일본어인지 (영어 번역 방향) */
    initialRequestSourceLang: z.enum(['ko', 'ja']).optional().default('ko'),
    priorityFirst: z.boolean().optional(),
    /** 농구 전용: 공식전 대상 */
    basketballOfficialGame: z.boolean().optional(),
    attachments: z.array(attachmentKeySchema).max(10).optional().default([]),
  })
  .superRefine((data, ctx) => {
    if (!isValidProductForSport(data.sport, data.product)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '종목에 맞는 상품을 선택하세요.',
        path: ['product'],
      });
    }
    if (data.basketballOfficialGame && data.sport !== 'BASKETBALL') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '공식전은 농구 요청만 선택할 수 있습니다.',
        path: ['basketballOfficialGame'],
      });
    }
  });

const listStatusFilterSchema = z.enum([
  'ALL',
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  /** 대기·진행 함께 (팀 대시보드 KPI) */
  'PENDING_IN_PROGRESS',
]);

const listQuerySchema = z.object({
  /** 단일 종목(하위 호환). `sports`가 있으면 무시됨 */
  sport: sportSchema.optional(),
  /** 콤마 구분 복수 종목 e.g. SOCCER,BASKETBALL — 비어 있으면 sport 또는 SOCCER */
  sports: z.string().max(120).optional().default(''),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(9),
  status: listStatusFilterSchema.optional().default('ALL'),
  unassignedOnly: z.enum(['true', 'false']).optional().default('false'),
  teamSearch: z.string().max(200).optional().default(''),
  /** ALL 또는 빈 값: 미적용. 그 외: 등록자(요청자) 이름 부분 일치(대소문자 무시) */
  registeredBy: z.string().max(200).optional().default('ALL'),
  /**
   * CS 전용: `false`가 아니면 등록자 필터가 비어 있을 때 본인(requesterId)만 조회.
   * 등록자 이름을 입력하면 이 옵션은 무시되고 이름 필터만 적용.
   */
  mineOnly: z.enum(['true', 'false']).optional(),
});

const patchSchema = z.object({
  status: statusSchema.optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  teamName: z.string().min(1).max(200).optional(),
  product: productStringSchema.optional(),
  version: versionSchema.optional(),
  initialRequest: z.string().min(1).max(10000).optional(),
  initialRequestSourceLang: z.enum(['ko', 'ja']).optional(),
  priorityFirst: z.boolean().optional(),
  basketballOfficialGame: z.boolean().optional(),
  removeAttachmentIds: z.array(z.string().uuid()).optional(),
  newAttachments: z.array(attachmentKeySchema).max(10).optional(),
});

/** 통계용: 한국시간(KST) 당일 YYYY-MM-DD */
function kstTodayYmd(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

function kstDayBounds(dateStr: string): { start: Date; end: Date } {
  return {
    start: new Date(`${dateStr}T00:00:00+09:00`),
    end: new Date(`${dateStr}T23:59:59.999+09:00`),
  };
}

/** 목록·통계: `from`~`to` 문자열을 한국시간(KST) 달력일로 해석해 `updatedAt` 구간 필터 */
function kstRangeBounds(fromStr: string, toStr: string): { start: Date; end: Date } {
  return {
    start: kstDayBounds(fromStr).start,
    end: kstDayBounds(toStr).end,
  };
}

/** 디자인 요청 일별 통계 집계 종목 (배구 등 제외) */
const STATS_DAILY_SPORTS: Array<'SOCCER' | 'BASKETBALL' | 'BASEBALL' | 'BASEBALL_HOF'> = [
  'SOCCER',
  'BASKETBALL',
  'BASEBALL',
  'BASEBALL_HOF',
];

const dailyStatsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** CS: `false`일 때만 등록자별 전체 표. 생략·true면 본인 행만 */
  mineOnly: z.enum(['true', 'false']).optional(),
});

function designDashboardRangeTooWide(start: Date, end: Date): boolean {
  return end.getTime() - start.getTime() > DESIGN_DASHBOARD_MAX_RANGE_MS;
}

const MAX_SEARCH_TERMS = 12;

/** 등록자 이름: 공백으로 구분한 검색어 (복수는 OR). 중복 제거, 최대 개수 제한 */
function splitSearchTerms(raw: string): string[] {
  const uniq = [...new Set(raw.split(/\s+/).map((s) => s.trim()).filter(Boolean))];
  return uniq.slice(0, MAX_SEARCH_TERMS);
}

/** 팀명: `?`로 구분한 검색어 (복수는 OR). 예: `A team ? B team` */
function splitTeamSearchTerms(raw: string): string[] {
  const uniq = [...new Set(raw.split('?').map((s) => s.trim()).filter(Boolean))];
  return uniq.slice(0, MAX_SEARCH_TERMS);
}

/** `_`/공백으로 토큰 분리 — `팀명_상품_1st` 형태를 AND 매칭하기 위함 */
function splitCompositeTokens(raw: string): string[] {
  const parts = raw.split(/[_\s]+/).map((s) => s.trim()).filter(Boolean);
  return parts.slice(0, MAX_SEARCH_TERMS);
}

/** 복사·표시용으로 붙은 일본식 괄호 「」『』만 토큰 앞뒤에서 제거 (DB에는 없는 경우가 많음) */
function normalizeSearchToken(token: string): string {
  return token
    .trim()
    .replace(/^[\u300c\u300e]+/g, '')
    .replace(/[\u300d\u300f]+$/g, '')
    .trim();
}

function parseVersionFromToken(token: string): number | null {
  const t = token.trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) {
    const n = parseInt(t, 10);
    if (n >= 1 && n <= 20) return n;
    return null;
  }
  for (let v = 1; v <= 20; v++) {
    if (designVersionOrdinal(v).toLowerCase() === t.toLowerCase()) return v;
  }
  return null;
}

/** 단일 토큰: 팀명·상품 부분 일치 또는 버전(1~20, 1st 등) 일치 */
function tokenWhere(token: string): Prisma.DesignRequestWhereInput {
  const trimmed = normalizeSearchToken(token);
  if (!trimmed) {
    return { id: { in: [] } };
  }
  const vn = parseVersionFromToken(trimmed);
  const orParts: Prisma.DesignRequestWhereInput[] = [
    { teamName: { contains: trimmed, mode: 'insensitive' } },
    { product: { contains: trimmed, mode: 'insensitive' } },
  ];
  if (vn !== null) {
    orParts.push({ version: vn });
  }
  return { OR: orParts };
}

/** `?`로 나뉜 각 구간: 토큰이 여러 개면 AND(복합 제목 검색), 하나면 단일 토큰 규칙 */
function termSearchWhere(term: string): Prisma.DesignRequestWhereInput {
  const trimmed = term.trim();
  const tokens = splitCompositeTokens(trimmed);
  if (tokens.length === 0) {
    if (!trimmed) return { id: { in: [] } };
    return tokenWhere(trimmed);
  }
  if (tokens.length === 1) return tokenWhere(tokens[0]!);
  return { AND: tokens.map((tok) => tokenWhere(tok)) };
}

/** 팀/상품/버전 검색: `?` 구간은 OR, 각 구간 내부는 토큰 AND */
function teamSearchWhere(teamSearch: string): Prisma.DesignRequestWhereInput | undefined {
  const terms = splitTeamSearchTerms(teamSearch);
  if (terms.length === 0) return undefined;
  if (terms.length === 1) return termSearchWhere(terms[0]!);
  return { OR: terms.map((t) => termSearchWhere(t)) };
}

/** 팀명 검색어가 있으면 목록·통계에서 기간(`from`~`to`) 필터를 적용하지 않고 전체 기간 검색 */
function hasTeamSearchActive(teamSearch: string): boolean {
  return teamSearchWhere(teamSearch) !== undefined;
}

/** ALL 또는 빈 문자열이면 필터 없음. 그 외: 요청자 직원명 부분 일치. 공백 구분 시 OR */
function requesterNameWhere(registeredBy: string): Prisma.DesignRequestWhereInput | undefined {
  const raw = registeredBy.trim();
  if (!raw || raw.toUpperCase() === 'ALL') return undefined;
  const terms = splitSearchTerms(raw);
  if (terms.length === 0) return undefined;
  if (terms.length === 1) {
    return {
      requester: {
        profile: { name: { contains: terms[0], mode: 'insensitive' } },
      },
    };
  }
  return {
    OR: terms.map((t) => ({
      requester: {
        profile: { name: { contains: t, mode: 'insensitive' } },
      },
    })),
  };
}

/** mineOnly: DESIGNER는 담당(assignee) 기준, 그 외(CS 등)는 등록자(requester) + 본인 재요청(RE_REQUEST)이 있는 건. 등록자 이름 필터가 켜지면 끔. */
type MineOnlyMode = 'off' | 'requester' | 'assignee';

/** 내 요청: 최초 등록자이거나, 해당 티켓에 본인이 단 재요청(RE_REQUEST)이 있으면 포함 */
function mineOnlyRequesterOrReRequestWhere(userId: string): Prisma.DesignRequestWhereInput {
  return {
    OR: [
      { requesterId: userId },
      {
        replies: {
          some: {
            userId,
            kind: 'RE_REQUEST',
          },
        },
      },
    ],
  };
}

function resolveMineOnlyMode(role: string, registeredBy: string, mineOnly: string | undefined): MineOnlyMode {
  const nameActive = Boolean(registeredBy.trim()) && registeredBy.trim().toUpperCase() !== 'ALL';
  if (nameActive) return 'off';

  if (mineOnly === 'true') {
    if (role === 'DESIGNER') return 'assignee';
    return 'requester';
  }
  if (mineOnly === 'false') return 'off';
  if (role === 'CS') return 'requester';
  return 'off';
}

function parseSportsFromQuery(sportsStr: string | undefined, sportLegacy: string | undefined): DesignRequestSport[] | null {
  const raw = (sportsStr ?? '').trim();
  if (raw.length > 0) {
    const uniq = [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))];
    const out: DesignRequestSport[] = [];
    for (const p of uniq) {
      const r = sportSchema.safeParse(p);
      if (!r.success) return null;
      out.push(r.data);
    }
    return out.length > 0 ? out : null;
  }
  if (sportLegacy) {
    const r = sportSchema.safeParse(sportLegacy);
    return r.success ? [r.data] : null;
  }
  return ['SOCCER'];
}

/** 종목·담당·팀·등록자 필터만 (날짜·상태 없음). 재요청 건수 집계 시 부모 요청 조건으로 사용 */
function buildDesignRequestParentFiltersNoDate(
  sports: DesignRequestSport[],
  req: AuthRequest,
  filters: {
    unassignedOnly: boolean;
    teamSearch: string;
    registeredBy: string;
    mineOnlyMode: MineOnlyMode;
  }
): Prisma.DesignRequestWhereInput {
  const assigneeOnlyId = req.user!.role === 'FOREIGN_FREELANCER' ? req.user!.id : null;
  const { unassignedOnly, teamSearch, registeredBy, mineOnlyMode } = filters;

  const teamW = teamSearchWhere(teamSearch);
  const baseCore: Prisma.DesignRequestWhereInput = {
    sport: sports.length === 1 ? sports[0]! : { in: sports },
  };

  if (assigneeOnlyId) {
    baseCore.assigneeId = assigneeOnlyId;
  } else if (unassignedOnly) {
    baseCore.assigneeId = null;
  } else if (mineOnlyMode === 'assignee') {
    baseCore.assigneeId = req.user!.id;
  }

  if (mineOnlyMode === 'requester') {
    Object.assign(baseCore, mineOnlyRequesterOrReRequestWhere(req.user!.id));
  }

  const reqW = requesterNameWhere(registeredBy);
  const parts: Prisma.DesignRequestWhereInput[] = [baseCore];
  if (teamW) parts.push(teamW);
  if (reqW) parts.push(reqW);
  if (parts.length === 1) return parts[0]!;
  return { AND: parts };
}

function buildDesignRequestListWhere(
  sports: DesignRequestSport[],
  start: Date,
  end: Date,
  req: AuthRequest,
  filters: {
    statusFilter:
      | 'ALL'
      | 'PENDING'
      | 'IN_PROGRESS'
      | 'COMPLETED'
      | 'PENDING_IN_PROGRESS';
    unassignedOnly: boolean;
    teamSearch: string;
    registeredBy: string;
    mineOnlyMode: MineOnlyMode;
  },
  options?: { dateField?: 'createdAt' | 'updatedAt' }
): Prisma.DesignRequestWhereInput {
  const dateField = options?.dateField ?? 'updatedAt';
  const { statusFilter, teamSearch } = filters;

  const teamW = teamSearchWhere(teamSearch);
  /** 팀명 검색 시: 날짜 구간 없이 전역 검색 */
  const dateScoped = teamW === undefined;

  const inner = buildDesignRequestParentFiltersNoDate(sports, req, filters);
  const dateClause: Prisma.DesignRequestWhereInput = dateScoped
    ? dateField === 'createdAt'
      ? { createdAt: { gte: start, lte: end } }
      : { updatedAt: { gte: start, lte: end } }
    : {};
  const statusClause: Prisma.DesignRequestWhereInput =
    statusFilter === 'ALL'
      ? {}
      : statusFilter === 'PENDING_IN_PROGRESS'
        ? { status: { in: ['PENDING', 'IN_PROGRESS'] } }
        : { status: statusFilter as DesignRequestStatus };

  const mergedParts: Prisma.DesignRequestWhereInput[] = [
    inner,
    ...(Object.keys(dateClause).length ? [dateClause] : []),
    ...(Object.keys(statusClause).length ? [statusClause] : []),
  ];
  if (mergedParts.length === 1) return mergedParts[0]!;
  return { AND: mergedParts };
}

/**
 * 단일일 조회(from===to) 시: 해당 KST 날짜 시작 이전에 마지막으로 갱신됐는데 아직 대기/진행 중인 건(이월 미완료).
 * 당일 필터만 쓸 때도 목록에 끌어올려 보이게 OR 조건으로 합침.
 */
function buildStaleCarryoverWhere(
  sports: DesignRequestSport[],
  dayStartKst: Date,
  req: AuthRequest,
  filters: {
    statusFilter:
      | 'ALL'
      | 'PENDING'
      | 'IN_PROGRESS'
      | 'COMPLETED'
      | 'PENDING_IN_PROGRESS';
    unassignedOnly: boolean;
    teamSearch: string;
    registeredBy: string;
    mineOnlyMode: MineOnlyMode;
  }
): Prisma.DesignRequestWhereInput | null {
  const { statusFilter, unassignedOnly, teamSearch, registeredBy, mineOnlyMode } = filters;
  if (statusFilter === 'COMPLETED') {
    return null;
  }
  const statusIn: DesignRequestStatus[] =
    statusFilter === 'ALL' || statusFilter === 'PENDING_IN_PROGRESS'
      ? ['PENDING', 'IN_PROGRESS']
      : ([statusFilter] as DesignRequestStatus[]);
  if (statusIn.length === 0) {
    return null;
  }

  const assigneeOnlyId = req.user!.role === 'FOREIGN_FREELANCER' ? req.user!.id : null;
  const baseCore: Prisma.DesignRequestWhereInput = {
    sport: sports.length === 1 ? sports[0]! : { in: sports },
    status: { in: statusIn },
    updatedAt: { lt: dayStartKst },
  };

  if (assigneeOnlyId) {
    baseCore.assigneeId = assigneeOnlyId;
  } else if (unassignedOnly) {
    baseCore.assigneeId = null;
  } else if (mineOnlyMode === 'assignee') {
    baseCore.assigneeId = req.user!.id;
  }

  if (mineOnlyMode === 'requester') {
    Object.assign(baseCore, mineOnlyRequesterOrReRequestWhere(req.user!.id));
  }

  const teamW = teamSearchWhere(teamSearch);
  const reqW = requesterNameWhere(registeredBy);
  const parts: Prisma.DesignRequestWhereInput[] = [baseCore];
  if (teamW) parts.push(teamW);
  if (reqW) parts.push(reqW);
  if (parts.length === 1) return parts[0]!;
  return { AND: parts };
}

const canCreateDesignRequest = (role: string) =>
  ['CS', 'MANAGER', 'SUPER_ADMIN', 'DESIGNER'].includes(role);

const canManageDesignRequest = (role: string) =>
  ['MANAGER', 'SUPER_ADMIN', 'DESIGNER'].includes(role);

const canEditRequest = (role: string, requesterId: string, userId: string) =>
  requesterId === userId || ['CS', 'MANAGER', 'SUPER_ADMIN', 'DESIGNER'].includes(role);

async function translateToEn(text: string, fromLang: 'ko' | 'ja'): Promise<string | null> {
  try {
    if (!text.trim()) return null;
    return await translate(text, fromLang, 'en');
  } catch (e) {
    console.warn('[designRequest] translate en:', e);
    return null;
  }
}

async function translateJaToKo(text: string): Promise<string | null> {
  try {
    if (!text.trim()) return null;
    return await translate(text, 'ja', 'ko');
  } catch (e) {
    console.warn('[designRequest] translate ja→ko:', e);
    return null;
  }
}

const attOrderAsc = [{ sortOrder: 'asc' as const }];

function attachReRequestIndexToReplies<
  T extends { id: string; kind: string; createdAt: Date | string },
>(replyList: T[]): Array<T & { reRequestIndex?: number }> {
  const ordered = [...replyList].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const m = new Map<string, number>();
  let n = 0;
  for (const r of ordered) {
    if (r.kind === 'RE_REQUEST') {
      n += 1;
      m.set(r.id, n);
    }
  }
  return replyList.map((r) => ({
    ...r,
    reRequestIndex: r.kind === 'RE_REQUEST' ? m.get(r.id) : undefined,
  }));
}

function designIncludeWithReplies() {
  return {
    requester: { include: { profile: true } },
    assignee: { include: { profile: true } },
    attachments: { orderBy: attOrderAsc },
    replies: {
      orderBy: { createdAt: 'desc' as const },
      include: {
        user: { include: { profile: true } },
        attachments: { orderBy: attOrderAsc },
      },
    },
  };
}

function designIncludeNoReplies() {
  return {
    requester: { include: { profile: true } },
    assignee: { include: { profile: true } },
    attachments: { orderBy: attOrderAsc },
  };
}

const replyInclude = {
  user: { include: { profile: true } },
  attachments: { orderBy: attOrderAsc },
};

export async function getUploadUrl(req: AuthRequest, res: Response) {
  if (!canCreateDesignRequest(req.user!.role)) {
    res.status(403).json({ message: '디자인 요청 등록 권한이 없습니다.' });
    return;
  }
  const schema = z.object({
    filename: z.string().min(1),
    mimeType: z.string().min(1),
    sport: sportSchema,
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: '잘못된 요청입니다.' });
    return;
  }
  const result = await getPresignedUploadUrlForDesign(
    parsed.data.filename,
    parsed.data.mimeType,
    req.user!.id,
    parsed.data.sport
  );
  if (!result) {
    res.status(503).json({ message: '파일 업로드 URL을 생성할 수 없습니다.', uploadUrl: null, s3Key: null });
    return;
  }
  res.json(result);
}

export async function getReplyUploadUrl(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const schema = z.object({
    filename: z.string().min(1),
    mimeType: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: '잘못된 요청입니다.' });
    return;
  }
  const dr = await prisma.designRequest.findUnique({ where: { id } });
  if (!dr) {
    res.status(404).json({ message: '요청을 찾을 수 없습니다.' });
    return;
  }
  const result = await getPresignedUploadUrlForDesign(
    parsed.data.filename,
    parsed.data.mimeType,
    req.user!.id,
    dr.sport
  );
  if (!result) {
    res.status(503).json({ message: '파일 업로드 URL을 생성할 수 없습니다.', uploadUrl: null, s3Key: null });
    return;
  }
  res.json(result);
}

export async function listDesignRequests(req: AuthRequest, res: Response) {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: '조회 조건이 올바르지 않습니다.' });
    return;
  }
  const {
    sport,
    sports: sportsParam,
    from,
    to,
    page,
    pageSize,
    status: statusFilter,
    unassignedOnly,
    teamSearch,
    registeredBy,
    mineOnly,
  } = parsed.data;
  const teamSearchActive = hasTeamSearchActive(teamSearch ?? '');
  const sportsList = parseSportsFromQuery(sportsParam, sport);
  if (!sportsList || sportsList.length === 0) {
    res.status(400).json({ message: '종목(sports)이 올바르지 않습니다.' });
    return;
  }

  const { start, end } = kstRangeBounds(from, to);
  if (start > end) {
    res.status(400).json({ message: '시작일이 종료일보다 늦을 수 없습니다.' });
    return;
  }
  if (!teamSearchActive && designDashboardRangeTooWide(start, end)) {
    res.status(400).json({ message: '조회 기간은 최대 1년입니다.' });
    return;
  }

  const mineOnlyMode = resolveMineOnlyMode(req.user!.role, registeredBy, mineOnly);
  const filterOpts = {
    statusFilter,
    unassignedOnly: unassignedOnly === 'true',
    teamSearch: teamSearch ?? '',
    registeredBy,
    mineOnlyMode,
  };
  const baseWhere = buildDesignRequestListWhere(sportsList, start, end, req, filterOpts);
  /** 단일일 이월 미처리(OR) 포함: 디자이너·해외 프리랜서(담당 건만). 팀명 검색(전역) 시 이월 OR 생략. */
  const staleWhere =
    !teamSearchActive &&
    (req.user!.role === 'DESIGNER' || req.user!.role === 'FOREIGN_FREELANCER') &&
    from === to
      ? buildStaleCarryoverWhere(sportsList, start, req, filterOpts)
      : null;
  const where =
    staleWhere !== null ? ({ OR: [baseWhere, staleWhere] } as Prisma.DesignRequestWhereInput) : baseWhere;

  const skip = (page - 1) * pageSize;

  try {
    const total = await prisma.designRequest.count({ where });

    /** 팀 관리 카드 배지와 동일 조건 — 순위: 이월+우선 > 이월만 > 우선만 > 둘 다 없음 */
    const rangeStartMs = start.getTime();
    type TeamDesignListSortRow = {
      id: string;
      priorityFirst: boolean;
      updatedAt: Date;
      createdAt: Date;
      status: string;
    };
    const teamDesignListRank = (row: TeamDesignListSortRow, reRequestPriorityIds: Set<string>): number => {
      const stale =
        row.updatedAt.getTime() < rangeStartMs &&
        (row.status === 'PENDING' || row.status === 'IN_PROGRESS');
      const priority =
        (row.priorityFirst || reRequestPriorityIds.has(row.id)) && row.status !== 'COMPLETED';
      if (stale && priority) return 4;
      if (stale) return 3;
      if (priority) return 2;
      return 1;
    };
    const compareTeamDesignListOrder = (
      a: TeamDesignListSortRow,
      b: TeamDesignListSortRow,
      reRequestPriorityIds: Set<string>
    ): number => {
      const ra = teamDesignListRank(a, reRequestPriorityIds);
      const rb = teamDesignListRank(b, reRequestPriorityIds);
      if (ra !== rb) return rb - ra;
      const ud = b.updatedAt.getTime() - a.updatedAt.getTime();
      if (ud !== 0) return ud;
      const cd = a.createdAt.getTime() - b.createdAt.getTime();
      if (cd !== 0) return cd;
      return a.id.localeCompare(b.id);
    };

    let ids: string[];
    if (teamSearchActive) {
      const pageRows = await prisma.designRequest.findMany({
        where,
        select: {
          id: true,
          priorityFirst: true,
          updatedAt: true,
          createdAt: true,
          status: true,
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take: pageSize,
      });
      ids = pageRows.map((r) => r.id);
    } else {
      const sortRows = await prisma.designRequest.findMany({
        where,
        select: {
          id: true,
          priorityFirst: true,
          updatedAt: true,
          createdAt: true,
          status: true,
        },
      });
      const sortRowIds = sortRows.map((r) => r.id);
      const reRequestPriorityRows =
        sortRowIds.length === 0
          ? []
          : await prisma.designRequestReply.findMany({
              where: {
                designRequestId: { in: sortRowIds },
                kind: 'RE_REQUEST',
                priorityFirst: true,
              } as unknown as Prisma.DesignRequestReplyWhereInput,
              select: { designRequestId: true },
            });
      const reRequestPriorityIdSet = new Set(reRequestPriorityRows.map((r) => r.designRequestId));
      sortRows.sort((a, b) => compareTeamDesignListOrder(a, b, reRequestPriorityIdSet));
      ids = sortRows.slice(skip, skip + pageSize).map((r) => r.id);
    }

    const itemsRaw =
      ids.length === 0
        ? []
        : await prisma.designRequest.findMany({
            where: { id: { in: ids } },
            include: {
              requester: { include: { profile: true } },
              assignee: { include: { profile: true } },
            },
            orderBy: { id: 'asc' },
          });

    /** 목록 카드 요약용: 요청별 최신 재요청(CS·관리자) 본문 */
    const latestReRequestById = new Map<
      string,
      { content: string; contentEn: string | null; contentKo: string | null }
    >();
    if (ids.length > 0) {
      const reRows = await prisma.designRequestReply.findMany({
        where: { designRequestId: { in: ids }, kind: 'RE_REQUEST' },
        orderBy: { createdAt: 'desc' },
        select: {
          designRequestId: true,
          content: true,
          contentEn: true,
          contentKo: true,
        },
      });
      for (const r of reRows) {
        if (!latestReRequestById.has(r.designRequestId)) {
          latestReRequestById.set(r.designRequestId, {
            content: r.content,
            contentEn: r.contentEn,
            contentKo: r.contentKo,
          });
        }
      }
    }

    const orderMap = new Map(ids.map((id, i) => [id, i]));
    const itemsSorted = [...itemsRaw].sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

    const rePriorSet = new Set<string>();
    if (ids.length > 0) {
      const rePriorRows = await prisma.designRequestReply.findMany({
        where: {
          designRequestId: { in: ids },
          kind: 'RE_REQUEST',
          priorityFirst: true,
        } as unknown as Prisma.DesignRequestReplyWhereInput,
        select: { designRequestId: true },
      });
      for (const r of rePriorRows) rePriorSet.add(r.designRequestId);
    }

    const dayStartMs = start.getTime();
    const items = itemsSorted.map((item) => ({
      ...item,
      isStaleCarryover: teamSearchActive
        ? false
        : item.updatedAt.getTime() < dayStartMs &&
          (item.status === 'PENDING' || item.status === 'IN_PROGRESS'),
      latestReRequest: latestReRequestById.get(item.id) ?? null,
      priorityFromReRequest: rePriorSet.has(item.id),
    }));

    res.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    });
  } catch (e) {
    console.error('[design-requests] list', e);
    const hint = dbUnavailableMessage(e);
    res.status(hint ? 503 : 500).json({ message: hint || '목록을 불러오지 못했습니다.' });
  }
}

export async function statsDesignRequests(req: AuthRequest, res: Response) {
  const parsed = listQuerySchema
    .pick({
      sport: true,
      sports: true,
      from: true,
      to: true,
      unassignedOnly: true,
      teamSearch: true,
      registeredBy: true,
      mineOnly: true,
    })
    .safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: '조회 조건이 올바르지 않습니다.' });
    return;
  }
  const { sport, sports: sportsParam, from, to, unassignedOnly, teamSearch, registeredBy, mineOnly } =
    parsed.data;
  const teamSearchActive = hasTeamSearchActive(teamSearch ?? '');
  const sportsList = parseSportsFromQuery(sportsParam, sport);
  if (!sportsList || sportsList.length === 0) {
    res.status(400).json({ message: '종목(sports)이 올바르지 않습니다.' });
    return;
  }

  const { start, end } = kstRangeBounds(from, to);
  if (start > end) {
    res.status(400).json({ message: '시작일이 종료일보다 늦을 수 없습니다.' });
    return;
  }
  if (!teamSearchActive && designDashboardRangeTooWide(start, end)) {
    res.status(400).json({ message: '조회 기간은 최대 1년입니다.' });
    return;
  }

  const mineOnlyMode = resolveMineOnlyMode(req.user!.role, registeredBy, mineOnly);
  const filterOpts = {
    statusFilter: 'ALL' as const,
    unassignedOnly: unassignedOnly === 'true',
    teamSearch: teamSearch ?? '',
    registeredBy,
    mineOnlyMode,
  };

  /** 등록팀 KPI: 기간 내 생성(등록)된 요청 — createdAt */
  const whereCreated = buildDesignRequestListWhere(sportsList, start, end, req, filterOpts, {
    dateField: 'createdAt',
  });
  /** 총 요청 건·완료·대기중 KPI: 디자인 요청 행 기준, 최종 업데이트 시점이 기간 내 — updatedAt (목록과 동일). 재요청 답글은 별도 행으로 합산하지 않음 */
  const whereUpdated = buildDesignRequestListWhere(sportsList, start, end, req, filterOpts);

  try {
    const [teamNameGroups, updatedDrCount, completedRegistered, pendingInProgressRegistered] =
      await Promise.all([
        prisma.designRequest.groupBy({
          by: ['teamName'],
          where: whereCreated,
          _count: { _all: true },
        }),
        prisma.designRequest.count({ where: whereUpdated }),
        prisma.designRequest.count({
          where: {
            AND: [whereUpdated, { status: 'COMPLETED' }],
          },
        }),
        prisma.designRequest.count({
          where: {
            AND: [whereUpdated, { status: { in: ['PENDING', 'IN_PROGRESS'] } }],
          },
        }),
      ]);

    const registeredTeams = teamNameGroups.length;
    const totalRequestEvents = updatedDrCount;

    res.json({
      registeredTeams,
      totalRequestEvents,
      completedRegistered,
      pendingInProgressRegistered,
    });
  } catch (e) {
    console.error('[design-requests] stats', e);
    const hint = dbUnavailableMessage(e);
    res.status(hint ? 503 : 500).json({ message: hint || '통계를 불러오지 못했습니다.' });
  }
}

/** 통계 '디자이너 배정': 직원 프로필 `position`이 이 값과 일치하는 담당자만 (역할 DESIGNER) */
const DAILY_STATS_DESIGNER_POSITION_LABEL = '디자이너';

/**
 * 당일(KST) 디자인 요청 통계
 * - 등록자별: 축구·농구·야구·야구(HOF) 신규 요청 건수, 재요청(RE_REQUEST) 등록 건수
 * - 해외 디자이너: 당일 생성된 요청 중 본인에게 배정된 건(종목별) + 당일 시안 작성(COMMENT) 건수(종목별)
 * - 디자이너: 직책(position)이 `디자이너`인 담당 배정 건 + 당일 시안 작성 건수(종목별)
 */
export async function dailyStatsDesignRequests(req: AuthRequest, res: Response) {
  const parsed = dailyStatsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: '조회 조건이 올바르지 않습니다.' });
    return;
  }
  const dateStr = parsed.data.date ?? kstTodayYmd();
  const mineOnly = parsed.data.mineOnly;
  const { start, end } = kstDayBounds(dateStr);

  try {
    const commentWhereBase = {
      createdAt: { gte: start, lte: end },
      kind: 'COMMENT' as const,
      designRequest: { sport: { in: STATS_DAILY_SPORTS } },
    };

    const [requestGroups, reRequestGroups, foreignGroups, designerGroups, foreignComments, designerComments] =
      await Promise.all([
        prisma.designRequest.groupBy({
          by: ['requesterId', 'sport'],
          where: {
            createdAt: { gte: start, lte: end },
            sport: { in: STATS_DAILY_SPORTS },
          },
          _count: { _all: true },
        }),
        prisma.designRequestReply.groupBy({
          by: ['userId'],
          where: {
            createdAt: { gte: start, lte: end },
            kind: 'RE_REQUEST',
          },
          _count: { _all: true },
        }),
        prisma.designRequest.groupBy({
          by: ['assigneeId', 'sport'],
          where: {
            createdAt: { gte: start, lte: end },
            sport: { in: STATS_DAILY_SPORTS },
            assigneeId: { not: null },
            assignee: { role: 'FOREIGN_FREELANCER' },
          },
          _count: { _all: true },
        }),
        prisma.designRequest.groupBy({
          by: ['assigneeId', 'sport'],
          where: {
            createdAt: { gte: start, lte: end },
            sport: { in: STATS_DAILY_SPORTS },
            assigneeId: { not: null },
            assignee: {
              role: 'DESIGNER',
              profile: { position: DAILY_STATS_DESIGNER_POSITION_LABEL },
            },
          },
          _count: { _all: true },
        }),
        prisma.designRequestReply.findMany({
          where: {
            ...commentWhereBase,
            user: { role: 'FOREIGN_FREELANCER' },
          },
          select: { userId: true, designRequest: { select: { sport: true } } },
        }),
        prisma.designRequestReply.findMany({
          where: {
            ...commentWhereBase,
            user: {
              role: 'DESIGNER',
              profile: { position: DAILY_STATS_DESIGNER_POSITION_LABEL },
            },
          },
          select: { userId: true, designRequest: { select: { sport: true } } },
        }),
      ]);

    const userIds = new Set<string>();
    for (const g of requestGroups) userIds.add(g.requesterId);
    for (const g of reRequestGroups) userIds.add(g.userId);
    for (const g of foreignGroups) {
      if (g.assigneeId) userIds.add(g.assigneeId);
    }
    for (const g of designerGroups) {
      if (g.assigneeId) userIds.add(g.assigneeId);
    }
    for (const c of foreignComments) userIds.add(c.userId);
    for (const c of designerComments) userIds.add(c.userId);

    const users = await prisma.user.findMany({
      where: { id: { in: [...userIds] } },
      select: {
        id: true,
        email: true,
        role: true,
        profile: { select: { name: true } },
      },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    type Row = {
      userId: string;
      name: string | null;
      email: string;
      soccer: number;
      basketball: number;
      baseball: number;
      baseballHof: number;
      reRequests: number;
    };
    const byUser = new Map<string, Row>();

    function ensureRow(id: string): Row {
      let row = byUser.get(id);
      if (!row) {
        const u = userMap.get(id);
        row = {
          userId: id,
          name: u?.profile?.name ?? null,
          email: u?.email ?? '',
          soccer: 0,
          basketball: 0,
          baseball: 0,
          baseballHof: 0,
          reRequests: 0,
        };
        byUser.set(id, row);
      }
      return row;
    }

    for (const g of requestGroups) {
      const row = ensureRow(g.requesterId);
      if (g.sport === 'SOCCER') row.soccer += g._count._all;
      else if (g.sport === 'BASKETBALL') row.basketball += g._count._all;
      else if (g.sport === 'BASEBALL') row.baseball += g._count._all;
      else if (g.sport === 'BASEBALL_HOF') row.baseballHof += g._count._all;
    }
    for (const g of reRequestGroups) {
      const row = ensureRow(g.userId);
      row.reRequests += g._count._all;
    }

    let requesterRows = [...byUser.values()].filter(
      (r) =>
        r.soccer > 0 ||
        r.basketball > 0 ||
        r.baseball > 0 ||
        r.baseballHof > 0 ||
        r.reRequests > 0,
    );
    requesterRows.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, 'ko'));

    if (req.user!.role === 'CS' && mineOnly !== 'false') {
      requesterRows = requesterRows.filter((r) => r.userId === req.user!.id);
    }

    type ForeignRow = {
      userId: string;
      name: string | null;
      email: string;
      soccer: number;
      basketball: number;
      baseball: number;
      baseballHof: number;
      commentsSoccer: number;
      commentsBasketball: number;
      commentsBaseball: number;
      commentsBaseballHof: number;
    };
    const foreignByUser = new Map<string, ForeignRow>();
    for (const g of foreignGroups) {
      const aid = g.assigneeId;
      if (!aid) continue;
      let row = foreignByUser.get(aid);
      if (!row) {
        const u = userMap.get(aid);
        row = {
          userId: aid,
          name: u?.profile?.name ?? null,
          email: u?.email ?? '',
          soccer: 0,
          basketball: 0,
          baseball: 0,
          baseballHof: 0,
          commentsSoccer: 0,
          commentsBasketball: 0,
          commentsBaseball: 0,
          commentsBaseballHof: 0,
        };
        foreignByUser.set(aid, row);
      }
      if (g.sport === 'SOCCER') row.soccer += g._count._all;
      else if (g.sport === 'BASKETBALL') row.basketball += g._count._all;
      else if (g.sport === 'BASEBALL') row.baseball += g._count._all;
      else if (g.sport === 'BASEBALL_HOF') row.baseballHof += g._count._all;
    }
    const foreignCommentByUser = new Map<
      string,
      { soccer: number; basketball: number; baseball: number; baseballHof: number }
    >();
    for (const c of foreignComments) {
      let agg = foreignCommentByUser.get(c.userId);
      if (!agg) {
        agg = { soccer: 0, basketball: 0, baseball: 0, baseballHof: 0 };
        foreignCommentByUser.set(c.userId, agg);
      }
      const sp = c.designRequest.sport;
      if (sp === 'SOCCER') agg.soccer += 1;
      else if (sp === 'BASKETBALL') agg.basketball += 1;
      else if (sp === 'BASEBALL') agg.baseball += 1;
      else if (sp === 'BASEBALL_HOF') agg.baseballHof += 1;
    }
    for (const [uid, agg] of foreignCommentByUser) {
      let row = foreignByUser.get(uid);
      if (!row) {
        const u = userMap.get(uid);
        row = {
          userId: uid,
          name: u?.profile?.name ?? null,
          email: u?.email ?? '',
          soccer: 0,
          basketball: 0,
          baseball: 0,
          baseballHof: 0,
          commentsSoccer: 0,
          commentsBasketball: 0,
          commentsBaseball: 0,
          commentsBaseballHof: 0,
        };
        foreignByUser.set(uid, row);
      }
      row.commentsSoccer = agg.soccer;
      row.commentsBasketball = agg.basketball;
      row.commentsBaseball = agg.baseball;
      row.commentsBaseballHof = agg.baseballHof;
    }
    const foreignRows = [...foreignByUser.values()]
      .filter(
        (r) =>
          r.soccer > 0 ||
          r.basketball > 0 ||
          r.baseball > 0 ||
          r.baseballHof > 0 ||
          r.commentsSoccer > 0 ||
          r.commentsBasketball > 0 ||
          r.commentsBaseball > 0 ||
          r.commentsBaseballHof > 0,
      )
      .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, 'ko'));

    type DesignerAggRow = {
      userId: string;
      name: string | null;
      email: string;
      soccer: number;
      basketball: number;
      baseball: number;
      baseballHof: number;
      commentsSoccer: number;
      commentsBasketball: number;
      commentsBaseball: number;
      commentsBaseballHof: number;
    };
    const designerByUser = new Map<string, DesignerAggRow>();
    for (const g of designerGroups) {
      const aid = g.assigneeId;
      if (!aid) continue;
      let row = designerByUser.get(aid);
      if (!row) {
        const u = userMap.get(aid);
        row = {
          userId: aid,
          name: u?.profile?.name ?? null,
          email: u?.email ?? '',
          soccer: 0,
          basketball: 0,
          baseball: 0,
          baseballHof: 0,
          commentsSoccer: 0,
          commentsBasketball: 0,
          commentsBaseball: 0,
          commentsBaseballHof: 0,
        };
        designerByUser.set(aid, row);
      }
      if (g.sport === 'SOCCER') row.soccer += g._count._all;
      else if (g.sport === 'BASKETBALL') row.basketball += g._count._all;
      else if (g.sport === 'BASEBALL') row.baseball += g._count._all;
      else if (g.sport === 'BASEBALL_HOF') row.baseballHof += g._count._all;
    }
    const designerCommentByUser = new Map<
      string,
      { soccer: number; basketball: number; baseball: number; baseballHof: number }
    >();
    for (const c of designerComments) {
      let agg = designerCommentByUser.get(c.userId);
      if (!agg) {
        agg = { soccer: 0, basketball: 0, baseball: 0, baseballHof: 0 };
        designerCommentByUser.set(c.userId, agg);
      }
      const sp = c.designRequest.sport;
      if (sp === 'SOCCER') agg.soccer += 1;
      else if (sp === 'BASKETBALL') agg.basketball += 1;
      else if (sp === 'BASEBALL') agg.baseball += 1;
      else if (sp === 'BASEBALL_HOF') agg.baseballHof += 1;
    }
    for (const [uid, agg] of designerCommentByUser) {
      let row = designerByUser.get(uid);
      if (!row) {
        const u = userMap.get(uid);
        row = {
          userId: uid,
          name: u?.profile?.name ?? null,
          email: u?.email ?? '',
          soccer: 0,
          basketball: 0,
          baseball: 0,
          baseballHof: 0,
          commentsSoccer: 0,
          commentsBasketball: 0,
          commentsBaseball: 0,
          commentsBaseballHof: 0,
        };
        designerByUser.set(uid, row);
      }
      row.commentsSoccer = agg.soccer;
      row.commentsBasketball = agg.basketball;
      row.commentsBaseball = agg.baseball;
      row.commentsBaseballHof = agg.baseballHof;
    }

    const designerAssignmentRows = [...designerByUser.values()]
      .filter(
        (r) =>
          r.soccer > 0 ||
          r.basketball > 0 ||
          r.baseball > 0 ||
          r.baseballHof > 0 ||
          r.commentsSoccer > 0 ||
          r.commentsBasketball > 0 ||
          r.commentsBaseball > 0 ||
          r.commentsBaseballHof > 0,
      )
      .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, 'ko'));

    res.json({
      date: dateStr,
      timezone: 'Asia/Seoul',
      byRequester: requesterRows,
      foreignFreelancerAssignments: foreignRows,
      designerAssignments: designerAssignmentRows,
    });
  } catch (e) {
    console.error('[design-requests] daily-stats', e);
    const hint = dbUnavailableMessage(e);
    res.status(hint ? 503 : 500).json({ message: hint || '통계를 불러오지 못했습니다.' });
  }
}

/** 같은 종목 + 같은 팀명(대소문자 무시) 요청 목록 — 버전 순, 목록과 동일하게 프리랜서는 담당 건만 */
/** 신규 등록 전: 동일 종목·팀명·상품·버전 조합 존재 여부 */
export async function checkDuplicateDesignRequest(req: AuthRequest, res: Response) {
  const sportParsed = sportSchema.safeParse(req.query.sport);
  const teamName =
    typeof req.query.teamName === 'string' ? req.query.teamName.trim().slice(0, 200) : '';
  const product =
    typeof req.query.product === 'string' ? req.query.product.trim().slice(0, 200) : '';
  const versionRaw = req.query.version;
  const version = Math.min(20, Math.max(1, parseInt(String(versionRaw ?? '1'), 10) || 1));

  if (!sportParsed.success || !teamName || !product) {
    res.status(400).json({ message: 'sport, teamName, product, version 쿼리가 필요합니다.' });
    return;
  }

  if (!isValidProductForSport(sportParsed.data, product)) {
    res.status(400).json({ message: '종목에 맞는 상품을 선택하세요.' });
    return;
  }

  try {
    const count = await prisma.designRequest.count({
      where: {
        sport: sportParsed.data,
        teamName: { equals: teamName, mode: 'insensitive' },
        product,
        version,
      },
    });
    res.json({ exists: count > 0 });
  } catch (e) {
    console.error('[design-requests] check-duplicate', e);
    const hint = dbUnavailableMessage(e);
    res.status(hint ? 503 : 500).json({ message: hint || '확인에 실패했습니다.' });
  }
}

export async function getDesignRequestSiblings(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const current = await prisma.designRequest.findUnique({
      where: { id },
      select: { id: true, sport: true, teamName: true },
    });
    if (!current) {
      res.status(404).json({ message: '요청을 찾을 수 없습니다.' });
      return;
    }

    const assigneeOnlyId = req.user!.role === 'FOREIGN_FREELANCER' ? req.user!.id : null;
    const where: Prisma.DesignRequestWhereInput = {
      sport: current.sport,
      teamName: { equals: current.teamName, mode: 'insensitive' },
      ...(assigneeOnlyId ? { assigneeId: assigneeOnlyId } : {}),
    };

    const list = await prisma.designRequest.findMany({
      where,
      select: { id: true, version: true, product: true, createdAt: true },
      orderBy: [{ version: 'asc' }, { createdAt: 'asc' }],
    });

    const idx = list.findIndex((r) => r.id === id);
    const prevId = idx > 0 ? list[idx - 1]!.id : null;
    const nextId = idx >= 0 && idx < list.length - 1 ? list[idx + 1]!.id : null;

    res.json({
      total: list.length,
      currentIndex: idx,
      prevId,
      nextId,
      siblings: list.map((r) => ({
        id: r.id,
        version: r.version,
        product: r.product,
      })),
    });
  } catch (e) {
    console.error('[design-requests] siblings', e);
    const hint = dbUnavailableMessage(e);
    res.status(hint ? 503 : 500).json({ message: hint || '목록을 불러오지 못했습니다.' });
  }
}

export async function getDesignRequest(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    let row = await prisma.designRequest.findUnique({
      where: { id },
      include: designIncludeWithReplies(),
    });
    if (!row) {
      res.status(404).json({ message: '요청을 찾을 수 없습니다.' });
      return;
    }

    if (
      req.user?.role === 'FOREIGN_FREELANCER' &&
      !row.initialRequestEn?.trim() &&
      row.initialRequest?.trim()
    ) {
      try {
        const fromLang = row.initialRequestLang === 'ja' ? 'ja' : 'ko';
        const en = await translateToEn(row.initialRequest, fromLang);
        if (en) {
          row = await prisma.designRequest.update({
            where: { id },
            data: { initialRequestEn: en },
            include: designIncludeWithReplies(),
          });
        }
      } catch (e) {
        console.error('[design-requests] get lazy translate/update', e);
      }
    }

    if (
      req.user?.role === 'DESIGNER' &&
      row.initialRequestLang === 'ja' &&
      row.initialRequest?.trim() &&
      !row.initialRequestKo?.trim()
    ) {
      try {
        const ko = await translateJaToKo(row.initialRequest);
        if (ko) {
          row = await prisma.designRequest.update({
            where: { id },
            data: { initialRequestKo: ko },
            include: designIncludeWithReplies(),
          });
        }
      } catch (e) {
        console.error('[design-requests] get lazy ja→ko', e);
      }
    }

    const withMeta = {
      ...row,
      replies: attachReRequestIndexToReplies(row.replies),
    };
    res.json(withMeta);
  } catch (e) {
    console.error('[design-requests] get', e);
    const hint = dbUnavailableMessage(e);
    res.status(hint ? 503 : 500).json({ message: hint || '요청을 불러오지 못했습니다.' });
  }
}

export async function createDesignRequest(req: AuthRequest, res: Response) {
  if (!canCreateDesignRequest(req.user!.role)) {
    res.status(403).json({ message: '디자인 요청 등록 권한이 없습니다.' });
    return;
  }
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: '입력값을 확인해 주세요.', errors: parsed.error.flatten() });
    return;
  }

  const {
    sport,
    teamName,
    product,
    version,
    initialRequest,
    initialRequestSourceLang,
    priorityFirst,
    basketballOfficialGame,
    attachments,
  } = parsed.data;

  const en = await translateToEn(initialRequest, initialRequestSourceLang);
  const koForDesigner =
    initialRequestSourceLang === 'ja' ? await translateJaToKo(initialRequest) : null;

  const created = await prisma.designRequest.create({
    data: {
      sport,
      teamName,
      product,
      version,
      initialRequest,
      initialRequestEn: en,
      initialRequestKo: koForDesigner,
      initialRequestLang: initialRequestSourceLang,
      priorityFirst: priorityFirst ?? false,
      basketballOfficialGame: sport === 'BASKETBALL' ? (basketballOfficialGame ?? false) : false,
      requesterId: req.user!.id,
      attachments: {
        create: attachments.map((a, i) => ({
          filename: a.filename,
          s3Key: a.s3Key,
          mimeType: a.mimeType,
          size: a.size,
          sortOrder: i,
        })),
      },
    },
    include: designIncludeNoReplies(),
  });

  try {
    await postDesignRequestChatNotification({
      sport: created.sport,
      requestId: created.id,
      teamName: created.teamName,
      product: created.product,
      initialRequest: created.initialRequest,
      userId: req.user!.id,
    });
  } catch (e) {
    console.error('[designRequest] chat notify error:', e);
  }

  res.status(201).json(created);
}

function canSetCompleted(role: string) {
  return role === 'CS' || role === 'MANAGER' || role === 'SUPER_ADMIN';
}

function canPostReRequestRole(role: string) {
  return role === 'CS' || role === 'MANAGER' || role === 'SUPER_ADMIN';
}

/**
 * 디자이너가 타인 답변을 수정·삭제할 때: 재요청(RE_REQUEST)은 전원(CS 등) 건 허용,
 * 코멘트·시안(COMMENT/DRAFT)은 국내·해외 디자이너가 쓴 것만 허용.
 */
function designerMayModerateOthersReply(reply: {
  kind: string;
  user?: { role?: string } | null;
}): boolean {
  if (reply.kind === 'RE_REQUEST') return true;
  const ar = reply.user?.role;
  return ar === 'DESIGNER' || ar === 'FOREIGN_FREELANCER';
}

function mayPatchOrDeleteReply(
  role: string,
  uid: string,
  reply: { userId: string; kind: string; user?: { role?: string } | null },
): boolean {
  if (reply.userId === uid) return true;
  if (role === 'MANAGER' || role === 'SUPER_ADMIN') return true;
  if (role === 'DESIGNER' && designerMayModerateOthersReply(reply)) return true;
  return false;
}

function canSetInProgress(role: string) {
  return ['MANAGER', 'SUPER_ADMIN', 'DESIGNER', 'FOREIGN_FREELANCER', 'CS'].includes(role);
}

export async function patchDesignRequest(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: '잘못된 요청입니다.' });
    return;
  }

  const existing = await prisma.designRequest.findUnique({
    where: { id },
    include: { attachments: true },
  });
  if (!existing) {
    res.status(404).json({ message: '요청을 찾을 수 없습니다.' });
    return;
  }

  const role = req.user!.role;
  const uid = req.user!.id;

  const data: Partial<{
    status: DesignRequestStatus;
    assigneeId: string | null;
    teamName: string;
    product: string;
    version: number;
    initialRequest: string;
    initialRequestEn: string | null;
    initialRequestKo: string | null;
    initialRequestLang: string;
    priorityFirst: boolean;
    basketballOfficialGame: boolean;
  }> = {};

  if (parsed.data.status !== undefined) {
    if (parsed.data.status === 'COMPLETED') {
      if (!canSetCompleted(role)) {
        res.status(403).json({ message: '완료 처리는 CS·관리자·대표만 가능합니다.' });
        return;
      }
    } else if (
      parsed.data.status === 'IN_PROGRESS' &&
      (existing.status === 'PENDING' || existing.status === 'COMPLETED')
    ) {
      if (existing.status === 'COMPLETED') {
        if (!canSetCompleted(role)) {
          res.status(403).json({ message: '완료 해제(진행중 복귀)는 CS·관리자·대표만 가능합니다.' });
          return;
        }
      } else if (!canSetInProgress(role)) {
        res.status(403).json({ message: '진행중으로 변경할 권한이 없습니다.' });
        return;
      }
    } else if (parsed.data.status === 'PENDING') {
      if (!canManageDesignRequest(role)) {
        res.status(403).json({ message: '상태 변경 권한이 없습니다.' });
        return;
      }
    } else if (!canManageDesignRequest(role)) {
      res.status(403).json({ message: '상태 변경 권한이 없습니다.' });
      return;
    }
    data.status = parsed.data.status;
  }

  if (parsed.data.assigneeId !== undefined) {
    if (role !== 'DESIGNER') {
      res.status(403).json({ message: '담당 배정은 디자이너만 변경할 수 있습니다.' });
      return;
    }
    if (parsed.data.assigneeId) {
      const u = await prisma.user.findUnique({
        where: { id: parsed.data.assigneeId },
        select: { id: true, role: true, isActive: true },
      });
      if (!u || !u.isActive || !['DESIGNER', 'FOREIGN_FREELANCER'].includes(u.role)) {
        res.status(400).json({ message: '담당자를 선택할 수 없습니다.' });
        return;
      }
    }
    data.assigneeId = parsed.data.assigneeId;
  }

  const editFields =
    parsed.data.teamName !== undefined ||
    parsed.data.product !== undefined ||
    parsed.data.version !== undefined ||
    parsed.data.initialRequest !== undefined ||
    parsed.data.priorityFirst !== undefined ||
    parsed.data.basketballOfficialGame !== undefined ||
    (parsed.data.removeAttachmentIds && parsed.data.removeAttachmentIds.length > 0) ||
    (parsed.data.newAttachments && parsed.data.newAttachments.length > 0);

  if (editFields) {
    if (!canEditRequest(role, existing.requesterId, uid)) {
      res.status(403).json({ message: '수정 권한이 없습니다.' });
      return;
    }
    if (parsed.data.teamName !== undefined) data.teamName = parsed.data.teamName;
    if (parsed.data.product !== undefined) {
      if (!isValidProductForSport(existing.sport, parsed.data.product)) {
        res.status(400).json({ message: '종목에 맞는 상품을 선택하세요.' });
        return;
      }
      data.product = parsed.data.product;
    }
    if (parsed.data.version !== undefined) data.version = parsed.data.version;
    if (parsed.data.initialRequest !== undefined) {
      const srcLang =
        parsed.data.initialRequestSourceLang ??
        (existing.initialRequestLang === 'ja' ? 'ja' : 'ko');
      data.initialRequest = parsed.data.initialRequest;
      data.initialRequestLang = srcLang;
      data.initialRequestEn = await translateToEn(parsed.data.initialRequest, srcLang);
      data.initialRequestKo =
        srcLang === 'ja' ? (await translateJaToKo(parsed.data.initialRequest)) ?? null : null;
    }
    if (parsed.data.priorityFirst !== undefined) data.priorityFirst = parsed.data.priorityFirst;
    if (parsed.data.basketballOfficialGame !== undefined) {
      if (existing.sport !== 'BASKETBALL') {
        res.status(400).json({ message: '공식전 설정은 농구 요청만 가능합니다.' });
        return;
      }
      data.basketballOfficialGame = parsed.data.basketballOfficialGame;
    }
  }

  const removeIds = parsed.data.removeAttachmentIds ?? [];
  const hasNewAtt = (parsed.data.newAttachments?.length ?? 0) > 0;
  const hasRemovals = removeIds.length > 0;

  if (
    Object.keys(data).length === 0 &&
    !hasRemovals &&
    !hasNewAtt
  ) {
    res.status(400).json({ message: '변경할 내용이 없습니다.' });
    return;
  }

  if (hasRemovals && !canEditRequest(role, existing.requesterId, uid)) {
    res.status(403).json({ message: '첨부 삭제 권한이 없습니다.' });
    return;
  }

  for (const attId of removeIds) {
    const att = existing.attachments.find((a) => a.id === attId);
    if (att) {
      await deleteS3Object(att.s3Key);
      await prisma.designRequestAttachment.delete({ where: { id: attId } });
    }
  }

  if (parsed.data.newAttachments && parsed.data.newAttachments.length > 0) {
    if (!canEditRequest(role, existing.requesterId, uid)) {
      res.status(403).json({ message: '수정 권한이 없습니다.' });
      return;
    }
    const lastAtt = await prisma.designRequestAttachment.findFirst({
      where: { designRequestId: id },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const start = (lastAtt?.sortOrder ?? -1) + 1;
    await prisma.designRequestAttachment.createMany({
      data: parsed.data.newAttachments.map((a, i) => ({
        designRequestId: id,
        filename: a.filename,
        s3Key: a.s3Key,
        mimeType: a.mimeType,
        size: a.size,
        sortOrder: start + i,
      })),
    });
  }

  const updatePayload =
    Object.keys(data).length > 0 ? data : hasRemovals || hasNewAtt ? { updatedAt: new Date() } : data;

  const updated = await prisma.designRequest.update({
    where: { id },
    data: updatePayload as Prisma.DesignRequestUpdateInput,
    include: designIncludeWithReplies(),
  });

  if (editFields) {
    const hadInitialPatch = parsed.data.initialRequest !== undefined;
    const hadAttChange = hasNewAtt || hasRemovals;
    const onlyPriorityFirstMeta =
      parsed.data.priorityFirst !== undefined &&
      parsed.data.teamName === undefined &&
      parsed.data.product === undefined &&
      parsed.data.version === undefined &&
      parsed.data.basketballOfficialGame === undefined &&
      !hadInitialPatch &&
      !hadAttChange;
    /** 알림 `변경:` 줄 — 팀명·상품 등은 위에 이미 나오므로 메타 묶음 문구는 넣지 않음 */
    const changeParts: string[] = [];
    if (hadInitialPatch) changeParts.push('요청 본문');
    if (hadAttChange) changeParts.push('첨부');
    const changePartsLabel =
      changeParts.length === 1 && changeParts[0] === '요청 본문'
        ? undefined
        : changeParts.length > 0
          ? changeParts.join(', ')
          : undefined;
    const bodyWasPatched = hadInitialPatch;

    try {
      if (onlyPriorityFirstMeta) {
        await postDesignInitialRequestEditNotification({
          sport: existing.sport,
          requestId: id,
          teamName: updated.teamName,
          product: updated.product,
          initialRequest: updated.initialRequest,
          userId: uid,
          priorityTargetOnly: true,
          priorityFirstOn: updated.priorityFirst,
        });
      } else {
        await postDesignInitialRequestEditNotification({
          sport: existing.sport,
          requestId: id,
          teamName: updated.teamName,
          product: updated.product,
          initialRequest: updated.initialRequest,
          userId: uid,
          ...(changePartsLabel ? { changePartsLabel } : {}),
          ...(changePartsLabel && !hadInitialPatch ? { bodyWasPatched: false } : {}),
        });
      }
    } catch (e) {
      console.error('[designRequest] initial edit notify error:', e);
    }
  }

  res.json(updated);
}

export async function deleteDesignRequest(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const row = await prisma.designRequest.findUnique({
    where: { id },
    include: { attachments: true },
  });
  if (!row) {
    res.status(404).json({ message: '요청을 찾을 수 없습니다.' });
    return;
  }
  if (!canEditRequest(req.user!.role, row.requesterId, req.user!.id)) {
    res.status(403).json({ message: '삭제 권한이 없습니다.' });
    return;
  }
  if (req.user!.role === 'DESIGNER') {
    res.status(403).json({ message: '디자인 요청 삭제는 CS·관리자만 가능합니다.' });
    return;
  }
  for (const att of row.attachments) {
    await deleteS3Object(att.s3Key);
  }
  const replies = await prisma.designRequestReply.findMany({
    where: { designRequestId: id },
    include: { attachments: true },
  });
  for (const r of replies) {
    for (const a of r.attachments) {
      await deleteS3Object(a.s3Key);
    }
  }
  await prisma.designRequest.delete({ where: { id } });
  res.status(204).send();
}

const replyBodySchema = z.object({
  content: z.string().max(10000).optional().default(''),
  kind: replyKindSchema.optional().default('COMMENT'),
  attachmentKeys: z.array(attachmentKeySchema).max(10).optional().default([]),
  /** 재요청(RE_REQUEST) 본문 영어 번역 시 원문 언어 */
  contentSourceLang: z.enum(['ko', 'ja']).optional().default('ko'),
  /** 재요청 등록·수정 시 디자인 요청의 우선 제작 여부(CS·관리자만 반영) */
  priorityFirst: z.boolean().optional(),
});

export async function addReply(req: AuthRequest, res: Response) {
  const parsed = replyBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: '잘못된 요청입니다.' });
    return;
  }
  const { id } = req.params;
  const { content, kind, attachmentKeys, contentSourceLang, priorityFirst: replyPriorityFirst } =
    parsed.data;
  const text = (content || '').trim();
  if (!text && attachmentKeys.length === 0) {
    res.status(400).json({ message: '내용 또는 시안 첨부가 필요합니다.' });
    return;
  }

  const dr = await prisma.designRequest.findUnique({ where: { id } });
  if (!dr) {
    res.status(404).json({ message: '요청을 찾을 수 없습니다.' });
    return;
  }

  if (kind === 'RE_REQUEST') {
    if (!canPostReRequestRole(req.user!.role)) {
      res.status(403).json({ message: '재요청은 CS·관리자만 등록할 수 있습니다.' });
      return;
    }
    if (dr.status === 'COMPLETED') {
      res.status(400).json({ message: '완료된 요청에는 재요청을 등록할 수 없습니다.' });
      return;
    }
  }

  let contentEn: string | null = null;
  let contentKo: string | null = null;
  if (kind === 'RE_REQUEST' && text) {
    contentEn = await translateToEn(text, contentSourceLang);
    if (contentSourceLang === 'ja') {
      contentKo = await translateJaToKo(text);
    }
  }

  const reply = await prisma.designRequestReply.create({
    data: {
      designRequestId: id,
      userId: req.user!.id,
      kind,
      content: text,
      ...(kind === 'RE_REQUEST'
        ? {
            contentEn,
            contentKo,
            priorityFirst:
              replyPriorityFirst !== undefined && canPostReRequestRole(req.user!.role)
                ? replyPriorityFirst
                : false,
          }
        : {}),
      attachments: {
        create: attachmentKeys.map((a, i) => ({
          filename: a.filename,
          s3Key: a.s3Key,
          mimeType: a.mimeType,
          size: a.size,
          sortOrder: i,
        })),
      },
    },
    include: replyInclude,
  });
  await prisma.designRequest.update({
    where: { id },
    data: {
      updatedAt: new Date(),
      /** 재요청 등록 시 팀 요청을 대기열로 되돌림(진행중·대기 모두 PENDING으로 통일) */
      ...(kind === 'RE_REQUEST' ? { status: 'PENDING' as const } : {}),
      /** 디자이너·해외 프리랜서가 코멘트로 완료 처리할 때 담당이 비어 있으면 본인 자동 배정(통계·내 담당 목록) */
      ...(kind === 'COMMENT' &&
      (req.user!.role === 'DESIGNER' || req.user!.role === 'FOREIGN_FREELANCER') &&
      !dr.assigneeId
        ? { assigneeId: req.user!.id }
        : {}),
    },
  });

  const designerClearsPriority =
    kind === 'COMMENT' &&
    (req.user!.role === 'DESIGNER' || req.user!.role === 'FOREIGN_FREELANCER') &&
    (text.length > 0 || attachmentKeys.length > 0);
  if (designerClearsPriority) {
    const inReRequestBlock =
      (await prisma.designRequestReply.count({
        where: {
          designRequestId: id,
          kind: 'RE_REQUEST',
          createdAt: { lt: reply.createdAt },
        },
      })) > 0;
    if (!inReRequestBlock) {
      if (dr.priorityFirst) {
        await prisma.designRequest.update({
          where: { id },
          data: { priorityFirst: false, updatedAt: new Date() },
        });
      }
    } else {
      const parentReRequest = await prisma.designRequestReply.findFirst({
        where: {
          designRequestId: id,
          kind: 'RE_REQUEST',
          createdAt: { lt: reply.createdAt },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, priorityFirst: true } as unknown as Prisma.DesignRequestReplySelect,
      });
      if (parentReRequest && (parentReRequest as { priorityFirst?: boolean }).priorityFirst) {
        await prisma.designRequestReply.update({
          where: { id: parentReRequest.id },
          data: { priorityFirst: false, updatedAt: new Date() } as Prisma.DesignRequestReplyUpdateInput,
        });
      }
    }
  }

  /** 디자이너·해외 프리랜서가 코멘트(COMMENT)를 남기면 요청을 완료 처리 */
  if (
    kind === 'COMMENT' &&
    (req.user!.role === 'DESIGNER' || req.user!.role === 'FOREIGN_FREELANCER')
  ) {
    await prisma.designRequest.update({
      where: { id },
      data: { status: 'COMPLETED', updatedAt: new Date() },
    });
  }

  if (kind === 'RE_REQUEST') {
    const reRequestNumber = await prisma.designRequestReply.count({
      where: {
        designRequestId: id,
        kind: 'RE_REQUEST',
        createdAt: { lte: reply.createdAt },
      },
    });
    try {
      await postDesignReRequestChatNotification({
        sport: dr.sport,
        requestId: id,
        replyId: reply.id,
        teamName: dr.teamName,
        product: dr.product,
        content: text,
        reRequestNumber,
        userId: req.user!.id,
      });
    } catch (e) {
      console.error('[designRequest] re-request notify error:', e);
    }
  }

  if (kind === 'COMMENT') {
    const inReRequestBlock =
      (await prisma.designRequestReply.count({
        where: {
          designRequestId: id,
          kind: 'RE_REQUEST',
          createdAt: { lt: reply.createdAt },
        },
      })) > 0;

    const r = req.user!.role;
    let mentionDone = false;
    if (r === 'DESIGNER' || r === 'FOREIGN_FREELANCER') {
      try {
        mentionDone = await postDesignReplyCompletionMentionNotifications({
          designRequestId: id,
          replyId: reply.id,
          requesterId: dr.requesterId,
          teamName: dr.teamName,
          product: dr.product,
          sport: dr.sport,
          replyContent: text,
          authorUserId: req.user!.id,
          inReRequestBlock,
        });
      } catch (e) {
        console.error('[designRequest] reply completion mention notify error:', e);
      }
    }
    if (!mentionDone) {
      try {
        const summary =
          text || (attachmentKeys.length > 0 ? '(첨부만)' : '');
        if (inReRequestBlock) {
          const reRequestNumber = await prisma.designRequestReply.count({
            where: {
              designRequestId: id,
              kind: 'RE_REQUEST',
              createdAt: { lt: reply.createdAt },
            },
          });
          await postDraftNotifyReRequestComment({
            sport: dr.sport,
            requestId: id,
            replyId: reply.id,
            requesterId: dr.requesterId,
            teamName: dr.teamName,
            product: dr.product,
            content: summary,
            reRequestNumber,
            userId: req.user!.id,
          });
        } else {
          await postDraftNotifyRequestComment({
            sport: dr.sport,
            requestId: id,
            replyId: reply.id,
            requesterId: dr.requesterId,
            teamName: dr.teamName,
            product: dr.product,
            contentSummary: summary,
            userId: req.user!.id,
          });
        }
      } catch (e) {
        console.error('[designRequest] draft request comment notify error:', e);
      }
    }
  }

  const replyOut = attachReRequestIndexToReplies([reply])[0];
  res.status(201).json(replyOut);
}

const patchReplySchema = z.object({
  content: z.string().max(10000).optional(),
  kind: replyKindSchema.optional(),
  attachmentKeys: z.array(attachmentKeySchema).max(10).optional(),
  removeAttachmentIds: z.array(z.string().uuid()).optional(),
  contentSourceLang: z.enum(['ko', 'ja']).optional(),
  priorityFirst: z.boolean().optional(),
});

export async function patchReply(req: AuthRequest, res: Response) {
  const { id, replyId } = req.params;
  const parsed = patchReplySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: '잘못된 요청입니다.' });
    return;
  }

  const reply = await prisma.designRequestReply.findUnique({
    where: { id: replyId },
    include: {
      attachments: true,
      designRequest: true,
      user: { select: { role: true } },
    },
  });
  if (!reply || reply.designRequestId !== id) {
    res.status(404).json({ message: '답변을 찾을 수 없습니다.' });
    return;
  }
  const uid = req.user!.id;
  const role = req.user!.role;
  if (!mayPatchOrDeleteReply(role, uid, reply)) {
    res.status(403).json({ message: '수정 권한이 없습니다.' });
    return;
  }

  for (const rid of parsed.data.removeAttachmentIds ?? []) {
    const att = reply.attachments.find((a) => a.id === rid);
    if (att) {
      await deleteS3Object(att.s3Key);
      await prisma.designRequestReplyAttachment.delete({ where: { id: rid } });
    }
  }

  if (parsed.data.attachmentKeys && parsed.data.attachmentKeys.length > 0) {
    const lastRa = await prisma.designRequestReplyAttachment.findFirst({
      where: { replyId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const start = (lastRa?.sortOrder ?? -1) + 1;
    await prisma.designRequestReplyAttachment.createMany({
      data: parsed.data.attachmentKeys.map((a, i) => ({
        replyId,
        filename: a.filename,
        s3Key: a.s3Key,
        mimeType: a.mimeType,
        size: a.size,
        sortOrder: start + i,
      })),
    });
  }

  const replyUpdate: Prisma.DesignRequestReplyUpdateInput & {
    contentEn?: string | null;
    contentKo?: string | null;
    priorityFirst?: boolean;
  } = {};
  if (parsed.data.content !== undefined) {
    const trimmed = parsed.data.content.trim();
    replyUpdate.content = trimmed;
    if (reply.kind === 'RE_REQUEST') {
      const srcLang = (parsed.data.contentSourceLang ?? 'ko') as 'ko' | 'ja';
      replyUpdate.contentEn = (await translateToEn(trimmed, srcLang)) ?? null;
      replyUpdate.contentKo = srcLang === 'ja' ? (await translateJaToKo(trimmed)) ?? null : null;
    }
  }
  if (parsed.data.kind !== undefined) replyUpdate.kind = parsed.data.kind;
  if (
    reply.kind === 'RE_REQUEST' &&
    parsed.data.priorityFirst !== undefined &&
    canPostReRequestRole(role)
  ) {
    replyUpdate.priorityFirst = parsed.data.priorityFirst;
  }

  const updated = await prisma.designRequestReply.update({
    where: { id: replyId },
    data: replyUpdate as Prisma.DesignRequestReplyUpdateInput,
    include: replyInclude,
  });
  await prisma.designRequest.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  const hadContentPatch = parsed.data.content !== undefined;
  const hadAttAdd = (parsed.data.attachmentKeys?.length ?? 0) > 0;
  const hadAttRemove = (parsed.data.removeAttachmentIds?.length ?? 0) > 0;
  const hadPriorityPatch =
    reply.kind === 'RE_REQUEST' &&
    parsed.data.priorityFirst !== undefined &&
    canPostReRequestRole(role);
  const reRequestPriorityOnly =
    hadPriorityPatch && !hadContentPatch && !hadAttAdd && !hadAttRemove;
  if (
    reply.kind === 'RE_REQUEST' &&
    reply.designRequest &&
    (hadContentPatch || hadAttAdd || hadAttRemove || hadPriorityPatch)
  ) {
    const dr = reply.designRequest;
    const reRequestNumber = await prisma.designRequestReply.count({
      where: {
        designRequestId: id,
        kind: 'RE_REQUEST',
        createdAt: { lte: updated.createdAt },
      },
    });
    try {
      await postDesignReRequestEditChatNotification({
        sport: dr.sport,
        requestId: id,
        replyId,
        teamName: dr.teamName,
        product: dr.product,
        content: updated.content,
        reRequestNumber,
        userId: uid,
        ...(reRequestPriorityOnly
          ? { priorityOnly: true, priorityFirstOn: updated.priorityFirst }
          : {}),
      });
    } catch (e) {
      console.error('[designRequest] re-request edit notify error:', e);
    }
  }

  res.json(updated);
}

export async function deleteReply(req: AuthRequest, res: Response) {
  const { id, replyId } = req.params;
  const reply = await prisma.designRequestReply.findUnique({
    where: { id: replyId },
    include: { attachments: true, user: { select: { role: true } } },
  });
  if (!reply || reply.designRequestId !== id) {
    res.status(404).json({ message: '답변을 찾을 수 없습니다.' });
    return;
  }
  const uid = req.user!.id;
  const role = req.user!.role;
  if (!mayPatchOrDeleteReply(role, uid, reply)) {
    res.status(403).json({ message: '삭제 권한이 없습니다.' });
    return;
  }
  if (role === 'DESIGNER' && reply.kind === 'RE_REQUEST') {
    res.status(403).json({ message: '재요청 삭제는 CS·관리자만 가능합니다.' });
    return;
  }
  for (const a of reply.attachments) {
    await deleteS3Object(a.s3Key);
  }
  await prisma.designRequestReply.delete({ where: { id: replyId } });
  await prisma.designRequest.update({
    where: { id },
    data: { updatedAt: new Date() },
  });
  res.status(204).send();
}

export async function listAssignees(_req: AuthRequest, res: Response) {
  const users = await prisma.user.findMany({
    where: { isActive: true, role: { in: ['DESIGNER', 'FOREIGN_FREELANCER'] } },
    select: { id: true, email: true, profile: { select: { name: true } }, role: true },
    orderBy: { email: 'asc' },
  });
  res.json(users);
}

/** presigned URL: 이미지는 `inline`으로 두어 새 탭·img src가 다운로드로 처리되지 않게 함 */
function presignedDispositionForMime(mimeType: string | null | undefined, filename: string): 'inline' | 'attachment' {
  const m = (mimeType || '').toLowerCase();
  if (m.startsWith('image/')) return 'inline';
  if (/\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(filename)) return 'inline';
  return 'attachment';
}

export async function getAttachmentDownloadUrl(req: AuthRequest, res: Response) {
  const { attachmentId } = req.params;
  const att = await prisma.designRequestAttachment.findUnique({
    where: { id: attachmentId },
    include: { designRequest: true },
  });
  if (!att) {
    res.status(404).json({ message: '첨부를 찾을 수 없습니다.' });
    return;
  }
  const exists = await checkS3KeyExists(att.s3Key);
  if (!exists) {
    res.status(404).json({ message: '파일이 S3에 존재하지 않습니다.' });
    return;
  }
  const base = buildDesignRequestDownloadBaseName(att.designRequest);
  const dlName = withOriginalExtension(base, att.filename);
  const url = await getPresignedDownloadUrl(att.s3Key, dlName, {
    disposition: presignedDispositionForMime(att.mimeType, att.filename),
  });
  if (!url) {
    res.status(503).json({ message: '다운로드 URL을 생성할 수 없습니다.' });
    return;
  }
  res.json({ downloadUrl: url, filename: dlName });
}

export async function getReplyAttachmentDownloadUrl(req: AuthRequest, res: Response) {
  const { attachmentId } = req.params;
  const att = await prisma.designRequestReplyAttachment.findUnique({
    where: { id: attachmentId },
    include: { reply: { include: { designRequest: true } } },
  });
  if (!att) {
    res.status(404).json({ message: '첨부를 찾을 수 없습니다.' });
    return;
  }
  const exists = await checkS3KeyExists(att.s3Key);
  if (!exists) {
    res.status(404).json({ message: '파일이 S3에 존재하지 않습니다.' });
    return;
  }
  const base = buildDesignRequestDownloadBaseName(att.reply.designRequest);
  const dlName = withOriginalExtension(base, att.filename);
  const url = await getPresignedDownloadUrl(att.s3Key, dlName, {
    disposition: presignedDispositionForMime(att.mimeType, att.filename),
  });
  if (!url) {
    res.status(503).json({ message: '다운로드 URL을 생성할 수 없습니다.' });
    return;
  }
  res.json({ downloadUrl: url, filename: dlName });
}

/** 답변 첨부 이미지: 오른쪽을 잘라 왼쪽만 남긴 고객용(선형 보간 폭) */
export async function getReplyAttachmentCustomerDownload(req: AuthRequest, res: Response) {
  const { attachmentId } = req.params;
  const att = await prisma.designRequestReplyAttachment.findUnique({
    where: { id: attachmentId },
    include: { reply: { include: { designRequest: true } } },
  });
  if (!att) {
    res.status(404).json({ message: '첨부를 찾을 수 없습니다.' });
    return;
  }

  const buffer = await getObjectBuffer(att.s3Key);
  if (!buffer) {
    res.status(503).json({ message: '파일을 불러오지 못했습니다.' });
    return;
  }

  try {
    const { buffer: outBuf, contentType, outputExtension } = await cropCustomerKeepLeft(
      buffer,
      att.mimeType,
      att.reply.designRequest.sport
    );
    const nameBase = buildDesignRequestDownloadBaseName(att.reply.designRequest);
    const outName = outputExtension
      ? `${nameBase}${outputExtension}`
      : withOriginalExtension(nameBase, att.filename);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', buildAttachmentContentDisposition(outName));
    res.send(outBuf);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'RASTER_IMAGE_ONLY') {
      res.status(400).json({ message: '고객용 다운로드는 래스터 이미지에만 적용됩니다.' });
      return;
    }
    if (msg === 'INVALID_IMAGE') {
      res.status(400).json({ message: '이미지를 읽을 수 없습니다.' });
      return;
    }
    console.error('[design-requests] customer-download', e);
    res.status(500).json({ message: '이미지 처리 중 오류가 발생했습니다.' });
  }
}
