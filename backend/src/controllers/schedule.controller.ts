import { Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const createTaskSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요.'),
  description: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  dueDate: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  assigneeIds: z.array(z.string()).optional(),
  projectId: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  progress: z.number().min(0).max(100).optional(),
});

const updateTaskSchema = createTaskSchema.partial();

async function resolveAssigneeNames(assigneeIds: string[] | null): Promise<string[]> {
  if (!assigneeIds || assigneeIds.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: assigneeIds } },
    include: { profile: true },
  });
  const map = new Map(users.map((u) => [u.id, u.profile?.name || u.email]));
  return assigneeIds.map((id) => map.get(id) || id).filter((x): x is string => Boolean(x));
}

function toTaskResponseSync(task: any, assigneeNames?: string[]) {
  const ids = (task.assigneeIds as string[] | null) || (task.assigneeId ? [task.assigneeId] : []);
  const names = assigneeNames ?? (task.assigneesResolved ? (task.assigneesResolved as string[]) : [task.assignee?.profile?.name || task.assignee?.email].filter(Boolean));
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
    projectId: task.projectId,
    startDate: task.startDate ? task.startDate.toISOString().slice(0, 10) : null,
    endDate: task.endDate ? task.endDate.toISOString().slice(0, 10) : null,
    progress: task.progress ?? 0,
    order: task.order,
    createdBy: task.createdBy,
    creatorName: task.creator?.profile?.name || task.creator?.email,
    assigneeId: task.assigneeId,
    assigneeIds: ids,
    assigneeName: names[0] || task.assignee?.profile?.name || task.assignee?.email,
    assigneeNames: names,
    projectColor: task.project?.color,
    projectName: task.project?.name ?? null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

/** 담당자 선택에서 제외할 이메일 (관리자, 대표) */
const EXCLUDED_ASSIGNEE_EMAILS = ['admin@jinsik.com'];

/** GET /schedule/assignable-users - 담당자 선택용 (DESIGNER, MANAGER, SUPER_ADMIN, CS+CS총괄) */
export const getAssignableUsers = async (_req: AuthRequest, res: Response): Promise<void> => {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { role: 'DESIGNER' },
        { role: 'MANAGER' },
        { role: 'SUPER_ADMIN' },
        { role: 'CS', profile: { position: 'CS총괄' } },
      ],
    },
    include: { profile: true },
    orderBy: { createdAt: 'asc' },
  });

  const filtered = users.filter((u) => !EXCLUDED_ASSIGNEE_EMAILS.includes(u.email));

  res.json(filtered.map((u) => ({
    id: u.id,
    name: u.profile?.name || u.email,
    email: u.email,
    role: u.role,
  })));
};

/** GET /schedule/tasks - 관리자/대표 전용 (year, projectId 쿼리 지원) */
export const getTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  const year = req.query.year ? parseInt(String(req.query.year), 10) : undefined;
  const projectId = req.query.projectId ? String(req.query.projectId) : undefined;

  const where: Record<string, unknown> = {};
  if (projectId) where.projectId = projectId;
  if (year) {
    const yStart = new Date(year, 0, 1);
    const yEnd = new Date(year, 11, 31);
    where.OR = [
      { project: { year } },
      { startDate: { gte: yStart, lte: yEnd } },
      { endDate: { gte: yStart, lte: yEnd } },
    ];
  }

  const tasks = await prisma.scheduleTask.findMany({
    where: Object.keys(where).length ? where : undefined,
    include: {
      project: true,
      creator: { include: { profile: true } },
      assignee: { include: { profile: true } },
    },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  });

  const allIds = new Set<string>();
  tasks.forEach((t: any) => {
    const ids = (t.assigneeIds as string[] | null) || (t.assigneeId ? [t.assigneeId] : []);
    ids.forEach((id) => allIds.add(id));
  });
  const users = allIds.size > 0 ? await prisma.user.findMany({
    where: { id: { in: Array.from(allIds) } },
    include: { profile: true },
  }) : [];
  const nameMap = new Map(users.map((u) => [u.id, u.profile?.name || u.email]));

  res.json(tasks.map((t: any) => {
    const ids = (t.assigneeIds as string[] | null) || (t.assigneeId ? [t.assigneeId] : []);
    const names = ids.map((id: string) => nameMap.get(id)).filter(Boolean) as string[];
    return toTaskResponseSync(t, names);
  }));
};

/** POST /schedule/tasks - 관리자/대표 전용 */
export const createTask = async (req: AuthRequest, res: Response): Promise<void> => {
  const result = createTaskSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: result.error.errors[0].message });
    return;
  }
  const data = result.data;
  const userId = req.user!.id;

  const maxOrder = await prisma.scheduleTask.aggregate({
    _max: { order: true },
    where: { status: data.status || 'TODO' },
  });
  const order = (maxOrder._max.order ?? 0) + 1;

  const toDate = (s: string | undefined) => (s ? new Date(s + 'T12:00:00.000Z') : null);
  const assigneeIds = data.assigneeIds && data.assigneeIds.length > 0 ? data.assigneeIds : (data.assigneeId ? [data.assigneeId] : null);
  const createData = {
    title: data.title,
    description: data.description ?? null,
    status: (data.status as any) || 'TODO',
    priority: (data.priority as any) || 'MEDIUM',
    dueDate: data.dueDate ? toDate(data.dueDate) : null,
    assigneeId: assigneeIds?.[0] ?? data.assigneeId ?? null,
    assigneeIds: assigneeIds ?? undefined,
    projectId: data.projectId || null,
    startDate: data.startDate ? toDate(data.startDate) : null,
    endDate: data.endDate ? toDate(data.endDate) : null,
    progress: data.progress ?? 0,
    order,
    createdBy: userId,
  } as any;

  const task = await prisma.scheduleTask.create({
    data: createData,
    include: {
      project: true,
      creator: { include: { profile: true } },
      assignee: { include: { profile: true } },
    },
  });
  const names = await resolveAssigneeNames(((task as any).assigneeIds as string[] | null) || (task.assigneeId ? [task.assigneeId] : []));
  res.status(201).json(toTaskResponseSync(task, names));
};

/** PATCH /schedule/tasks/:id - 관리자/대표 전용 */
export const updateTask = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id;
  const result = updateTaskSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: result.error.errors[0].message });
    return;
  }
  const data = result.data as Record<string, unknown>;
  const toDate = (s: string | undefined) => (s ? new Date((s as string) + 'T12:00:00.000Z') : null);

  const existing = await prisma.scheduleTask.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ message: '일정을 찾을 수 없습니다.' });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.dueDate !== undefined) updateData.dueDate = toDate(data.dueDate as string);
  if (data.projectId !== undefined) updateData.projectId = data.projectId;
  if (data.startDate !== undefined) updateData.startDate = toDate(data.startDate as string);
  if (data.endDate !== undefined) updateData.endDate = toDate(data.endDate as string);
  if (data.progress !== undefined) updateData.progress = Number(data.progress);
  if (data.assigneeIds !== undefined) {
    const ids = data.assigneeIds as string[] | null;
    updateData.assigneeIds = ids;
    updateData.assigneeId = Array.isArray(ids) && ids.length > 0 ? ids[0] : null;
  }

  const task = await prisma.scheduleTask.update({
    where: { id },
    data: updateData as any,
    include: {
      project: true,
      creator: { include: { profile: true } },
      assignee: { include: { profile: true } },
    },
  });
  const names = await resolveAssigneeNames(((task as any).assigneeIds as string[] | null) || (task.assigneeId ? [task.assigneeId] : []));
  res.json(toTaskResponseSync(task, names));
};

/** DELETE /schedule/tasks/:id - 관리자/대표 전용 */
export const deleteTask = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id;
  const existing = await prisma.scheduleTask.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ message: '일정을 찾을 수 없습니다.' });
    return;
  }
  await prisma.scheduleTask.delete({ where: { id } });
  res.status(204).send();
};
