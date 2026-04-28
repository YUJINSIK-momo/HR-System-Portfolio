import { Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

function toDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** YYYY-MM-DD를 Date로 파싱 (타임존 밀림 방지: 정오 UTC 사용) */
function parseDateOnly(s: string): Date {
  return new Date(s + 'T12:00:00.000Z');
}

const createEventSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요.'),
  description: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
});

const createMemoSchema = z.object({
  date: z.string(),
  content: z.string(),
  isShared: z.boolean().default(false),
});

const updateMemoSchema = z.object({
  content: z.string().optional(),
  isShared: z.boolean().optional(),
});

/** GET /calendar/events?start=YYYY-MM-DD&end=YYYY-MM-DD */
export const getEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  const start = req.query.start as string;
  const end = req.query.end as string;
  if (!start || !end) {
    res.status(400).json({ message: 'start, end 파라미터가 필요합니다.' });
    return;
  }
  const startDate = new Date(start);
  const endDate = new Date(end);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  const events = await prisma.calendarEvent.findMany({
    where: {
      OR: [
        {
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
      ],
    },
    include: { creator: { include: { profile: true } } },
    orderBy: { startDate: 'asc' },
  });

  /** 디자이너가 아니면 외국 프리랜서가 만든 일정 숨김 */
  const viewerRole = req.user!.role;
  const isDesigner = viewerRole === 'DESIGNER';
  const filtered = isDesigner ? events : events.filter((e) => (e.creator as any)?.role !== 'FOREIGN_FREELANCER');

  res.json(filtered.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    startDate: toDateKey(new Date(e.startDate)),
    endDate: toDateKey(new Date(e.endDate)),
    createdBy: e.createdBy,
    creatorName: e.creator?.profile?.name || e.creator?.email,
    createdAt: e.createdAt,
  })));
};

/** POST /calendar/events */
export const createEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  const result = createEventSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: result.error.errors[0].message });
    return;
  }
  const { title, description, startDate, endDate } = result.data;
  const userId = req.user!.id;

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start > end) {
    res.status(400).json({ message: '종료일이 시작일보다 이전일 수 없습니다.' });
    return;
  }

  const event = await prisma.calendarEvent.create({
    data: {
      title,
      description: description || null,
      startDate: start,
      endDate: end,
      createdBy: userId,
    },
    include: { creator: { include: { profile: true } } },
  });

  res.status(201).json({
    id: event.id,
    title: event.title,
    description: event.description,
    startDate: toDateKey(new Date(event.startDate)),
    endDate: toDateKey(new Date(event.endDate)),
    createdBy: event.createdBy,
    creatorName: event.creator?.profile?.name || event.creator?.email,
    createdAt: event.createdAt,
  });
};

/** PATCH /calendar/events/:id */
export const updateEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id;
  const result = createEventSchema.partial().safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: result.error.errors[0].message });
    return;
  }
  const update = result.data as Record<string, unknown>;
  if (update.startDate) update.startDate = new Date(update.startDate as string);
  if (update.endDate) update.endDate = new Date(update.endDate as string);

  const event = await prisma.calendarEvent.findUnique({ where: { id } });
  if (!event) {
    res.status(404).json({ message: '일정을 찾을 수 없습니다.' });
    return;
  }

  const updated = await prisma.calendarEvent.update({
    where: { id },
    data: update,
    include: { creator: { include: { profile: true } } },
  });

  res.json({
    id: updated.id,
    title: updated.title,
    description: updated.description,
    startDate: toDateKey(new Date(updated.startDate)),
    endDate: toDateKey(new Date(updated.endDate)),
    createdBy: updated.createdBy,
    creatorName: updated.creator?.profile?.name || updated.creator?.email,
    createdAt: updated.createdAt,
  });
};

/** DELETE /calendar/events/:id */
export const deleteEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id;
  const event = await prisma.calendarEvent.findUnique({ where: { id } });
  if (!event) {
    res.status(404).json({ message: '일정을 찾을 수 없습니다.' });
    return;
  }
  await prisma.calendarEvent.delete({ where: { id } });
  res.status(204).send();
};

/** GET /calendar/memos?start=YYYY-MM-DD&end=YYYY-MM-DD - 공유 메모 + 내 메모 */
export const getMemos = async (req: AuthRequest, res: Response): Promise<void> => {
  const start = req.query.start as string;
  const end = req.query.end as string;
  const userId = req.user!.id;
  if (!start || !end) {
    res.status(400).json({ message: 'start, end 파라미터가 필요합니다.' });
    return;
  }
  const startDate = new Date(start + 'T00:00:00.000Z');
  const endDate = new Date(end + 'T23:59:59.999Z');

  const memos = await prisma.calendarMemo.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      OR: [
        { isShared: true },
        { userId },
      ],
    },
    include: { user: { include: { profile: true } } },
    orderBy: { date: 'asc' },
  });

  /** 외국 프리랜서 공유 메모: 디자이너만 확인 가능 (내 메모는 항상 표시) */
  const viewerRole = req.user?.role;
  const isDesigner = viewerRole === 'DESIGNER';
  const filteredMemos = isDesigner
    ? memos
    : memos.filter((m) => m.userId === userId || !(m.isShared && (m.user as any)?.role === 'FOREIGN_FREELANCER'));

  res.json(filteredMemos.map((m) => ({
    id: m.id,
    date: toDateKey(new Date(m.date)),
    content: m.content,
    isShared: m.isShared,
    userId: m.userId,
    userName: m.user?.profile?.name || m.user?.email,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  })));
};

/** POST /calendar/memos - 새 메모 추가 (같은 날짜에 여러 개 가능) */
export const createMemo = async (req: AuthRequest, res: Response): Promise<void> => {
  const result = createMemoSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: result.error.errors[0].message });
    return;
  }
  const { date, content, isShared } = result.data;
  const userId = req.user!.id;
  const dateObj = parseDateOnly(date);

  const memo = await prisma.calendarMemo.create({
    data: { date: dateObj, content, isShared, userId },
    include: { user: { include: { profile: true } } },
  });

  res.status(201).json({
    id: memo.id,
    date: toDateKey(new Date(memo.date)),
    content: memo.content,
    isShared: memo.isShared,
    userId: memo.userId,
    userName: memo.user?.profile?.name || memo.user?.email,
    createdAt: memo.createdAt,
    updatedAt: memo.updatedAt,
  });
};

/** PATCH /calendar/memos/:id */
export const updateMemo = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id;
  const result = updateMemoSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: result.error.errors[0].message });
    return;
  }
  const memo = await prisma.calendarMemo.findUnique({ where: { id } });
  if (!memo) {
    res.status(404).json({ message: '메모를 찾을 수 없습니다.' });
    return;
  }
  if (memo.userId !== req.user!.id) {
    res.status(403).json({ message: '본인 메모만 수정할 수 있습니다.' });
    return;
  }

  const updated = await prisma.calendarMemo.update({
    where: { id },
    data: result.data,
    include: { user: { include: { profile: true } } },
  });

  res.json({
    id: updated.id,
    date: toDateKey(new Date(updated.date)),
    content: updated.content,
    isShared: updated.isShared,
    userId: updated.userId,
    userName: updated.user?.profile?.name || updated.user?.email,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  });
};

/** DELETE /calendar/memos/:id */
export const deleteMemo = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id;
  const memo = await prisma.calendarMemo.findUnique({ where: { id } });
  if (!memo) {
    res.status(404).json({ message: '메모를 찾을 수 없습니다.' });
    return;
  }
  if (memo.userId !== req.user!.id) {
    res.status(403).json({ message: '본인 메모만 삭제할 수 있습니다.' });
    return;
  }
  await prisma.calendarMemo.delete({ where: { id } });
  res.status(204).send();
};

/** GET /calendar/memo-reminders - 7일 이내 메모 리마인드 (내 메모만, 오늘 ~ 7일 후) */
export const getMemoReminders = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7Days = new Date(today);
  in7Days.setDate(in7Days.getDate() + 7);
  in7Days.setHours(23, 59, 59, 999);

  const memos = await prisma.calendarMemo.findMany({
    where: {
      userId,
      date: { gte: today, lte: in7Days },
    },
    include: { user: { include: { profile: true } } },
    orderBy: { date: 'asc' },
  });

  res.json(memos.map((m) => {
    const memoDate = new Date(m.date);
    const diffDays = Math.ceil((memoDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    return {
      id: m.id,
      date: toDateKey(memoDate),
      content: m.content,
      isShared: m.isShared,
      daysUntil: diffDays,
      createdAt: m.createdAt,
    };
  }));
};

/** GET /calendar/leaves?start=YYYY-MM-DD&end=YYYY-MM-DD - 승인된 휴가 목록 */
export const getLeaves = async (req: AuthRequest, res: Response): Promise<void> => {
  const start = req.query.start as string;
  const end = req.query.end as string;
  if (!start || !end) {
    res.status(400).json({ message: 'start, end 파라미터가 필요합니다.' });
    return;
  }
  const startDate = new Date(start + 'T00:00:00.000Z');
  const endDate = new Date(end + 'T23:59:59.999Z');

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      status: 'APPROVED',
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    include: { user: { include: { profile: true } } },
    orderBy: { startDate: 'asc' },
  });

  /** 외국 프리랜서 휴가: 디자이너만 확인 가능 */
  const viewerRole = req.user?.role;
  const filteredLeaves =
    viewerRole === 'DESIGNER'
      ? leaves
      : leaves.filter((l) => l.user?.role !== 'FOREIGN_FREELANCER');

  const leaveTypeLabels: Record<string, string> = {
    ANNUAL: '연차',
    HALF_DAY_AM: '오전 반차',
    HALF_DAY_PM: '오후 반차',
    QUARTER_DAY: '반반차',
    SICK: '병결',
    OFFICIAL: '공가',
    FAMILY: '경조휴가',
  };

  const familySubLabels: Record<string, string> = {
    OWN_MARRIAGE: '본인 결혼',
    CHILD_MARRIAGE: '자녀 결혼',
    SPOUSE_CHILDBIRTH: '배우자 출산',
    PARENT_DEATH: '부모·배우자 부모 사망',
    GRANDPARENT_DEATH: '조부모·외조부모 사망',
    SIBLING_DEATH: '형제자매 사망',
  };

  const byDate: Record<
    string,
    Array<{ userId: string; userName: string; type: string; days: number; isOverseasWork: boolean }>
  > = {};
  for (const l of filteredLeaves) {
    const userName = l.user?.profile?.name || l.user?.email || '';
    /** 출근 시 해외 근무로 자동 생성·승인되는 연차 차감 건 (캘린더에서 휴가와 구분) */
    const isOverseasWork =
      l.type === 'ANNUAL' && typeof l.reason === 'string' && l.reason.includes('해외 근무 1일');
    const typeLabel = isOverseasWork
      ? '해외 근무'
      : l.type === 'FAMILY' && (l as { familySubType?: string | null }).familySubType
        ? `경조(${familySubLabels[(l as { familySubType: string }).familySubType] ?? (l as { familySubType: string }).familySubType})`
        : leaveTypeLabels[l.type] || l.type;
    const startKey = toDateKey(new Date(l.startDate));
    const endKey = toDateKey(new Date(l.endDate));
    let iter = new Date(startKey + 'T12:00:00.000Z');
    const endD = new Date(endKey + 'T12:00:00.000Z');
    while (iter <= endD) {
      const key = toDateKey(iter);
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push({ userId: l.userId, userName, type: typeLabel, days: l.days, isOverseasWork });
      iter = new Date(iter.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  res.json(byDate);
};
