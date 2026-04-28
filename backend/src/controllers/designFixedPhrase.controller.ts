import { Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import type { DesignFixedPhraseLang, DesignRequestSport } from '@prisma/client';

function parseLang(raw: string | undefined): DesignFixedPhraseLang | null {
  const u = (raw ?? '').toUpperCase();
  if (u === 'KO') return 'KO';
  if (u === 'JA') return 'JA';
  return null;
}

const SPORTS: DesignRequestSport[] = [
  'SOCCER',
  'BASKETBALL',
  'BASEBALL',
  'BASEBALL_HOF',
  'VOLLEYBALL',
];

function parseSport(raw: string | undefined): DesignRequestSport | null {
  const u = (raw ?? '').toUpperCase();
  if (SPORTS.includes(u as DesignRequestSport)) return u as DesignRequestSport;
  return null;
}

const phraseOrderBy = [
  { isPinned: 'desc' as const },
  { sortOrder: 'asc' as const },
  { updatedAt: 'desc' as const },
];

export async function listDesignFixedPhrases(req: AuthRequest, res: Response) {
  const lang = parseLang(typeof req.query.lang === 'string' ? req.query.lang : undefined);
  const sport = parseSport(typeof req.query.sport === 'string' ? req.query.sport : undefined);
  if (!lang || !sport) {
    res.status(400).json({ message: 'lang=ko|ja 와 sport=SOCCER|BASKETBALL|… 가 필요합니다.' });
    return;
  }
  try {
    const items = await prisma.designFixedPhrase.findMany({
      where: { lang, sport },
      orderBy: phraseOrderBy,
      select: {
        id: true,
        title: true,
        message: true,
        lang: true,
        sport: true,
        sortOrder: true,
        isPinned: true,
      },
    });
    res.json({ items });
  } catch (e) {
    console.error('[design-fixed-phrases] list', e);
    res.status(500).json({ message: '정형문을 불러오지 못했습니다.' });
  }
}

export async function adminListDesignFixedPhrases(req: AuthRequest, res: Response) {
  const lang = parseLang(typeof req.query.lang === 'string' ? req.query.lang : undefined);
  const sport = parseSport(typeof req.query.sport === 'string' ? req.query.sport : undefined);
  try {
    const items = await prisma.designFixedPhrase.findMany({
      where:
        lang && sport
          ? { lang, sport }
          : lang
            ? { lang }
            : sport
              ? { sport }
              : undefined,
      orderBy: phraseOrderBy,
    });
    res.json({ items });
  } catch (e) {
    console.error('[admin design-fixed-phrases] list', e);
    res.status(500).json({ message: '정형문을 불러오지 못했습니다.' });
  }
}

const createSchema = z.object({
  title: z.string().max(300).optional(),
  message: z.string().min(1),
  lang: z.enum(['KO', 'JA']),
  sport: z.enum(['SOCCER', 'BASKETBALL', 'BASEBALL', 'BASEBALL_HOF', 'VOLLEYBALL']),
  sortOrder: z.number().int().optional(),
  isPinned: z.boolean().optional(),
});

export async function createDesignFixedPhrase(req: AuthRequest, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: '입력값이 올바르지 않습니다.' });
    return;
  }
  try {
    const title = (parsed.data.title ?? '').trim();
    const row = await prisma.designFixedPhrase.create({
      data: {
        title,
        message: parsed.data.message,
        lang: parsed.data.lang,
        sport: parsed.data.sport,
        sortOrder: parsed.data.sortOrder ?? 0,
        isPinned: parsed.data.isPinned ?? false,
      },
    });
    res.status(201).json(row);
  } catch (e) {
    console.error('[admin design-fixed-phrases] create', e);
    res.status(500).json({ message: '저장에 실패했습니다.' });
  }
}

const updateSchema = z.object({
  title: z.string().max(300).optional(),
  message: z.string().min(1).optional(),
  lang: z.enum(['KO', 'JA']).optional(),
  sport: z.enum(['SOCCER', 'BASKETBALL', 'BASEBALL', 'BASEBALL_HOF', 'VOLLEYBALL']).optional(),
  sortOrder: z.number().int().optional(),
  isPinned: z.boolean().optional(),
});

export async function updateDesignFixedPhrase(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: '입력값이 올바르지 않습니다.' });
    return;
  }
  try {
    const data: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) data.title = parsed.data.title.trim();
    if (parsed.data.message !== undefined) data.message = parsed.data.message;
    if (parsed.data.lang !== undefined) data.lang = parsed.data.lang;
    if (parsed.data.sport !== undefined) data.sport = parsed.data.sport;
    if (parsed.data.sortOrder !== undefined) data.sortOrder = parsed.data.sortOrder;
    if (parsed.data.isPinned !== undefined) data.isPinned = parsed.data.isPinned;
    const row = await prisma.designFixedPhrase.update({
      where: { id },
      data,
    });
    res.json(row);
  } catch {
    res.status(404).json({ message: '항목을 찾을 수 없습니다.' });
  }
}

export async function deleteDesignFixedPhrase(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    await prisma.designFixedPhrase.delete({ where: { id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ message: '항목을 찾을 수 없습니다.' });
  }
}
