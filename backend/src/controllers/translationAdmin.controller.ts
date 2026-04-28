import path from 'path';
import fs from 'fs';
import { Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { invalidateTranslationCache, refreshTranslationCache } from '../services/translationData.service';

/** prisma/seed.js와 동일: 프로젝트 루트의 translation/guideline */
const TRANSLATION_GUIDELINE_DIR = path.join(__dirname, '..', '..', '..', 'translation', 'guideline');

const categorySchema = z.string().min(1).max(120);

const koJsonSchema = z.union([z.string(), z.array(z.string())]);

const listQuerySchema = z.object({
  category: categorySchema.optional(),
});

const createBodySchema = z.object({
  category: categorySchema,
  ko: koJsonSchema,
  en: z.string().max(2000),
  ja: z.string().max(2000).optional().default(''),
  sortOrder: z.number().int().optional(),
});

const updateBodySchema = z.object({
  ko: koJsonSchema.optional(),
  en: z.string().max(2000).optional(),
  ja: z.string().max(2000).optional(),
  sortOrder: z.number().int().optional(),
  category: categorySchema.optional(),
});

const guidelinePutSchema = z.object({
  content: z.string().max(100_000),
});

const importDictJsonSchema = z.object({
  category: categorySchema,
  /** true면 해당 카테고리 기존 행 전부 삭제 후 삽입 */
  replace: z.boolean().optional().default(false),
  /** 레포 colors.json 형식({ entries: [{src,tgt}] }) 또는 [{ko,en,ja}] */
  payload: z.unknown(),
});

const MAX_DICTIONARY_IMPORT = 8000;

function normalizeKoFromLegacySrc(src: unknown): string | string[] {
  if (Array.isArray(src)) return src.map((s) => String(s));
  if (typeof src === 'string') return src;
  return String(src ?? '');
}

function parseDictionaryImportEntries(
  payload: unknown
): Array<{ ko: string | string[]; en: string; ja: string }> {
  const out: Array<{ ko: string | string[]; en: string; ja: string }> = [];
  if (payload === null || payload === undefined) return out;
  const rawList = Array.isArray(payload)
    ? payload
    : (payload as Record<string, unknown>).entries;
  if (!Array.isArray(rawList)) return out;

  for (const e of rawList) {
    if (!e || typeof e !== 'object') continue;
    const row = e as Record<string, unknown>;
    if ('ko' in row && 'en' in row) {
      const ko = row.ko;
      const en = String(row.en ?? '').trim();
      const ja = String(row.ja ?? '').trim();
      if (ko === undefined || !en) continue;
      const koNorm: string | string[] = Array.isArray(ko) ? ko.map(String) : String(ko);
      out.push({ ko: koNorm, en, ja });
      continue;
    }
    if ('src' in row && 'tgt' in row) {
      const tgt = String(row.tgt ?? '').trim();
      if (!tgt) continue;
      const ko = normalizeKoFromLegacySrc(row.src);
      const ja = String(row.ja ?? '').trim();
      out.push({ ko, en: tgt, ja });
    }
  }
  return out;
}

export async function listDictionaryCategories(req: AuthRequest, res: Response) {
  const rows = await prisma.translationDictionaryEntry.groupBy({
    by: ['category'],
    _count: { _all: true },
  });
  res.json({ categories: rows.map((r) => ({ category: r.category, count: r._count._all })) });
}

export async function listDictionary(req: AuthRequest, res: Response) {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: '쿼리가 올바르지 않습니다.' });
    return;
  }
  const { category } = parsed.data;
  const where = category ? { category } : {};
  const entries = await prisma.translationDictionaryEntry.findMany({
    where,
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  res.json({ entries });
}

export async function createDictionaryEntry(req: AuthRequest, res: Response) {
  const parsed = createBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: '입력이 올바르지 않습니다.' });
    return;
  }
  const row = await prisma.translationDictionaryEntry.create({
    data: {
      category: parsed.data.category,
      ko: parsed.data.ko as object,
      en: parsed.data.en,
      ja: parsed.data.ja ?? '',
      sortOrder: parsed.data.sortOrder ?? 0,
    },
  });
  invalidateTranslationCache();
  await refreshTranslationCache();
  res.status(201).json(row);
}

export async function updateDictionaryEntry(req: AuthRequest, res: Response) {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ message: 'id가 필요합니다.' });
    return;
  }
  const parsed = updateBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: '입력이 올바르지 않습니다.' });
    return;
  }
  const data: {
    ko?: object;
    en?: string;
    ja?: string;
    sortOrder?: number;
    category?: string;
  } = {};
  if (parsed.data.ko !== undefined) data.ko = parsed.data.ko as object;
  if (parsed.data.en !== undefined) data.en = parsed.data.en;
  if (parsed.data.ja !== undefined) data.ja = parsed.data.ja;
  if (parsed.data.sortOrder !== undefined) data.sortOrder = parsed.data.sortOrder;
  if (parsed.data.category !== undefined) data.category = parsed.data.category;

  const row = await prisma.translationDictionaryEntry.update({
    where: { id },
    data,
  });
  invalidateTranslationCache();
  await refreshTranslationCache();
  res.json(row);
}

export async function deleteDictionaryEntry(req: AuthRequest, res: Response) {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ message: 'id가 필요합니다.' });
    return;
  }
  await prisma.translationDictionaryEntry.delete({ where: { id } });
  invalidateTranslationCache();
  await refreshTranslationCache();
  res.status(204).send();
}

/** JSON 파일(레포 dictionary/*.json 또는 ko/en/ja 배열) 일괄 반영 */
export async function importDictionaryJson(req: AuthRequest, res: Response) {
  const parsed = importDictJsonSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: '입력이 올바르지 않습니다.' });
    return;
  }
  const { category, replace, payload } = parsed.data;
  const entries = parseDictionaryImportEntries(payload);
  if (entries.length === 0) {
    res.status(400).json({
      message: '가져올 항목이 없습니다. entries 배열 또는 ko·en(또는 src·tgt) 형식인지 확인하세요.',
    });
    return;
  }
  if (entries.length > MAX_DICTIONARY_IMPORT) {
    res.status(400).json({ message: `한 번에 최대 ${MAX_DICTIONARY_IMPORT}개까지 가져올 수 있습니다.` });
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (replace) {
      await tx.translationDictionaryEntry.deleteMany({ where: { category } });
    }
    const maxRow = await tx.translationDictionaryEntry.aggregate({
      where: { category },
      _max: { sortOrder: true },
    });
    let start = (maxRow._max.sortOrder ?? -1) + 1;
    await tx.translationDictionaryEntry.createMany({
      data: entries.map((e, i) => ({
        category,
        ko: e.ko as object,
        en: e.en,
        ja: e.ja,
        sortOrder: start + i,
      })),
    });
  });

  invalidateTranslationCache();
  await refreshTranslationCache();
  res.json({ imported: entries.length, category, replace });
}

const backupQuerySchema = z.object({
  scope: z.enum(['all', 'dictionary', 'guidelines']).optional().default('all'),
});

/** DB의 고정 딕셔너리·가이드라인을 JSON으로 내보내기 (백업) */
export async function exportTranslationBackup(req: AuthRequest, res: Response) {
  const parsed = backupQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: '쿼리가 올바르지 않습니다.' });
    return;
  }
  const { scope } = parsed.data;
  const exportedAt = new Date().toISOString();

  const payload: {
    version: number;
    exportedAt: string;
    scope: 'all' | 'dictionary' | 'guidelines';
    dictionary?: Array<{
      id: string;
      category: string;
      ko: unknown;
      en: string;
      ja: string;
      sortOrder: number;
    }>;
    guidelines?: Array<{ name: string; content: string; updatedAt: string }>;
  } = {
    version: 1,
    exportedAt,
    scope,
  };

  if (scope === 'all' || scope === 'dictionary') {
    const rows = await prisma.translationDictionaryEntry.findMany({
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    payload.dictionary = rows.map((r) => ({
      id: r.id,
      category: r.category,
      ko: r.ko,
      en: r.en,
      ja: r.ja,
      sortOrder: r.sortOrder,
    }));
  }

  if (scope === 'all' || scope === 'guidelines') {
    const rows = await prisma.translationGuideline.findMany({
      orderBy: { name: 'asc' },
    });
    payload.guidelines = rows.map((g) => ({
      name: g.name,
      content: g.content,
      updatedAt: g.updatedAt.toISOString(),
    }));
  }

  res.json(payload);
}

export async function listGuidelines(req: AuthRequest, res: Response) {
  const rows = await prisma.translationGuideline.findMany({
    select: { name: true, updatedAt: true },
    orderBy: { name: 'asc' },
  });
  res.json({ guidelines: rows });
}

export async function getGuideline(req: AuthRequest, res: Response) {
  const name = req.params.name;
  if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
    res.status(400).json({ message: '유효하지 않은 이름입니다.' });
    return;
  }
  const row = await prisma.translationGuideline.findUnique({ where: { name } });
  if (!row) {
    res.status(404).json({ message: '가이드라인을 찾을 수 없습니다.' });
    return;
  }
  res.json(row);
}

export async function putGuideline(req: AuthRequest, res: Response) {
  const name = req.params.name;
  if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
    res.status(400).json({ message: '유효하지 않은 이름입니다.' });
    return;
  }
  const parsed = guidelinePutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'content가 필요합니다.' });
    return;
  }
  const row = await prisma.translationGuideline.upsert({
    where: { name },
    create: { name, content: parsed.data.content },
    update: { content: parsed.data.content },
  });
  invalidateTranslationCache();
  await refreshTranslationCache();
  res.json(row);
}

/** 레포의 translation/guideline/*.md → DB upsert 후 캐시 갱신 (시드와 동일 로직) */
export async function syncGuidelinesFromRepo(req: AuthRequest, res: Response) {
  if (!fs.existsSync(TRANSLATION_GUIDELINE_DIR)) {
    res.status(404).json({ message: 'translation/guideline 폴더를 찾을 수 없습니다. 서버 작업 디렉터리를 확인하세요.' });
    return;
  }
  const files = fs.readdirSync(TRANSLATION_GUIDELINE_DIR).filter((f) => f.endsWith('.md'));
  const synced: string[] = [];
  for (const file of files) {
    const name = file.replace(/\.md$/i, '');
    const content = fs.readFileSync(path.join(TRANSLATION_GUIDELINE_DIR, file), 'utf-8');
    await prisma.translationGuideline.upsert({
      where: { name },
      create: { name, content },
      update: { content },
    });
    synced.push(name);
  }
  synced.sort();
  invalidateTranslationCache();
  await refreshTranslationCache();
  res.json({ synced, count: synced.length });
}
