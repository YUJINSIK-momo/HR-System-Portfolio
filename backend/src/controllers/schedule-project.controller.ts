import { Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const createProjectSchema = z.object({
  name: z.string().min(1, '프로젝트명을 입력해주세요.'),
  description: z.string().optional(),
  color: z.string().optional(),
  year: z.number().int().min(2000).max(2100),
  order: z.number().int().optional(),
});

const updateProjectSchema = createProjectSchema.partial();

function toProjectResponse(project: any, nameMap: Map<string, string>) {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    color: project.color,
    year: project.year,
    order: project.order,
    taskCount: project._count?.tasks ?? project.tasks?.length ?? 0,
    tasks: project.tasks?.map((t: any) => {
      const ids = (t.assigneeIds as string[] | null) || (t.assigneeId ? [t.assigneeId] : []);
      const names = ids.map((id) => nameMap.get(id)).filter(Boolean) as string[];
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        projectId: t.projectId,
        projectColor: project.color,
        startDate: t.startDate ? t.startDate.toISOString().slice(0, 10) : null,
        endDate: t.endDate ? t.endDate.toISOString().slice(0, 10) : null,
        progress: t.progress,
        assigneeId: t.assigneeId,
        assigneeIds: ids,
        assigneeName: names[0] || t.assignee?.profile?.name || t.assignee?.email,
        assigneeNames: names,
      };
    }),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

/** GET /schedule/projects?year=2026 */
export const getProjects = async (req: AuthRequest, res: Response): Promise<void> => {
  const year = req.query.year ? parseInt(String(req.query.year), 10) : new Date().getFullYear();
  if (isNaN(year)) {
    res.status(400).json({ message: '유효한 연도를 입력해주세요.' });
    return;
  }

  const projects = await prisma.scheduleProject.findMany({
    where: { year },
    include: {
      tasks: {
        include: { assignee: { include: { profile: true } } },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      },
      _count: { select: { tasks: true } },
    },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  });

  const allIds = new Set<string>();
  projects.forEach((p) =>
    (p.tasks || []).forEach((t: any) => {
      const ids = (t.assigneeIds as string[] | null) || (t.assigneeId ? [t.assigneeId] : []);
      ids.forEach((id) => allIds.add(id));
    })
  );
  const users = allIds.size > 0 ? await prisma.user.findMany({
    where: { id: { in: Array.from(allIds) } },
    include: { profile: true },
  }) : [];
  const nameMap = new Map<string, string>(users.map((u) => [u.id, u.profile?.name || u.email] as [string, string]));

  res.json(projects.map((p) => toProjectResponse(p, nameMap)));
};

/** POST /schedule/projects */
export const createProject = async (req: AuthRequest, res: Response): Promise<void> => {
  const result = createProjectSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: result.error.errors[0].message });
    return;
  }
  const data = result.data;

  const maxOrder = await prisma.scheduleProject.aggregate({
    _max: { order: true },
    where: { year: data.year },
  });
  const order = data.order ?? (maxOrder._max.order ?? 0) + 1;

  const project = await prisma.scheduleProject.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      color: data.color ?? '#3B82F6',
      year: data.year,
      order,
    },
    include: {
      tasks: { include: { assignee: { include: { profile: true } } } },
      _count: { select: { tasks: true } },
    },
  });
  const nameMap = new Map<string, string>();
  if (project.tasks?.length) {
    const ids = new Set<string>();
    project.tasks.forEach((t: any) => {
      const arr = (t.assigneeIds as string[] | null) || (t.assigneeId ? [t.assigneeId] : []);
      arr.forEach((id) => ids.add(id));
    });
    const users = ids.size > 0 ? await prisma.user.findMany({
      where: { id: { in: Array.from(ids) } },
      include: { profile: true },
    }) : [];
    users.forEach((u) => nameMap.set(u.id, u.profile?.name || u.email));
  }
  res.status(201).json(toProjectResponse(project, nameMap));
};

/** PATCH /schedule/projects/:id */
export const updateProject = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id;
  const result = updateProjectSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: result.error.errors[0].message });
    return;
  }

  const existing = await prisma.scheduleProject.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ message: '프로젝트를 찾을 수 없습니다.' });
    return;
  }

  const project = await prisma.scheduleProject.update({
    where: { id },
    data: result.data,
    include: {
      tasks: { include: { assignee: { include: { profile: true } } } },
      _count: { select: { tasks: true } },
    },
  });
  const allIds = new Set<string>();
  (project.tasks || []).forEach((t: any) => {
    const ids = (t.assigneeIds as string[] | null) || (t.assigneeId ? [t.assigneeId] : []);
    ids.forEach((id) => allIds.add(id));
  });
  const users = allIds.size > 0 ? await prisma.user.findMany({
    where: { id: { in: Array.from(allIds) } },
    include: { profile: true },
  }) : [];
  const nameMap = new Map<string, string>(users.map((u) => [u.id, u.profile?.name || u.email] as [string, string]));
  res.json(toProjectResponse(project, nameMap));
};

/** DELETE /schedule/projects/:id */
export const deleteProject = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id;
  const existing = await prisma.scheduleProject.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ message: '프로젝트를 찾을 수 없습니다.' });
    return;
  }
  await prisma.scheduleProject.delete({ where: { id } });
  res.status(204).send();
};
