import { Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const createSchema = z.object({
  title: z.string().min(1).max(500),
});

const updateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  done: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const listPersonalTodos = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const items = await prisma.schedulePersonalTodo.findMany({
    where: { userId },
    orderBy: [{ done: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  res.json(items);
};

export const createPersonalTodo = async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }
  const userId = req.user!.id;
  const maxRow = await prisma.schedulePersonalTodo.aggregate({
    where: { userId, done: false },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxRow._max.sortOrder ?? -1) + 1;
  const row = await prisma.schedulePersonalTodo.create({
    data: { userId, title: parsed.data.title.trim(), sortOrder },
  });
  res.status(201).json(row);
};

export const updatePersonalTodo = async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }
  const userId = req.user!.id;
  const id = req.params.id;
  const existing = await prisma.schedulePersonalTodo.findFirst({ where: { id, userId } });
  if (!existing) {
    res.status(404).json({ message: 'Not found' });
    return;
  }
  const row = await prisma.schedulePersonalTodo.update({
    where: { id },
    data: {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title.trim() } : {}),
      ...(parsed.data.done !== undefined ? { done: parsed.data.done } : {}),
      ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
    },
  });
  res.json(row);
};

export const deletePersonalTodo = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const id = req.params.id;
  const existing = await prisma.schedulePersonalTodo.findFirst({ where: { id, userId } });
  if (!existing) {
    res.status(404).json({ message: 'Not found' });
    return;
  }
  await prisma.schedulePersonalTodo.delete({ where: { id } });
  res.status(204).send();
};
