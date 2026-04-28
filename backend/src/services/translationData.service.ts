import path from 'path';
import fs from 'fs';
import prisma from '../lib/prisma';

const TRANSLATION_ROOT = path.resolve(__dirname, '../../..');
const DICT_DIR = path.join(TRANSLATION_ROOT, 'translation', 'dictionary');
const GUIDELINE_DIR = path.join(TRANSLATION_ROOT, 'translation', 'guideline');

export type TranslationCache = {
  /** 번역 방향 키: ko-en, ko-ja, en-ko, en-ja, ja-ko, ja-en */
  linesByDirection: Map<string, string[]>;
  guidelines: Record<string, string>;
};

let cache: TranslationCache | null = null;

function formatKo(ko: unknown): string {
  if (Array.isArray(ko)) return ko.join(' | ');
  if (ko === null || ko === undefined) return '';
  return String(ko);
}

type TripleRow = { ko: unknown; en: string; ja: string };

function buildDirectionLines(rows: TripleRow[], fromLang: string, toLang: string): string[] {
  const out: string[] = [];
  for (const row of rows) {
    const ko = formatKo(row.ko);
    const en = (row.en ?? '').trim();
    const ja = (row.ja ?? '').trim();
    let left = '';
    let right = '';
    if (fromLang === 'ko' && toLang === 'en') {
      left = ko;
      right = en;
    } else if (fromLang === 'ko' && toLang === 'ja') {
      left = ko;
      right = ja;
    } else if (fromLang === 'en' && toLang === 'ko') {
      left = en;
      right = ko;
    } else if (fromLang === 'en' && toLang === 'ja') {
      left = en;
      right = ja;
    } else if (fromLang === 'ja' && toLang === 'ko') {
      left = ja;
      right = ko;
    } else if (fromLang === 'ja' && toLang === 'en') {
      left = ja;
      right = en;
    }
    if (!left || !right) continue;
    out.push(`${left} → ${right}`);
  }
  return out;
}

/** ko-en JSON 파일에서 항목 로드 (DB 비어 있을 때 폴백) */
function loadFallbackRowsFromFiles(): TripleRow[] {
  const rows: TripleRow[] = [];
  try {
    const files = fs.readdirSync(DICT_DIR).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const content = JSON.parse(fs.readFileSync(path.join(DICT_DIR, file), 'utf-8'));
      const list = content?.entries ?? content?.rules ?? [];
      for (const e of list) {
        if (e.src && e.tgt) {
          rows.push({ ko: e.src, en: e.tgt, ja: '' });
        }
      }
    }
  } catch (err) {
    console.warn('[Translation] Dictionary file fallback error:', err);
  }
  return rows;
}

function loadGuidelinesFromFiles(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const files = fs.readdirSync(GUIDELINE_DIR).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      const name = file.replace('.md', '');
      out[name] = fs.readFileSync(path.join(GUIDELINE_DIR, file), 'utf-8');
    }
  } catch (err) {
    console.warn('[Translation] Guideline file fallback error:', err);
  }
  return out;
}

function fillLinesMap(rows: TripleRow[]): Map<string, string[]> {
  const linesByDirection = new Map<string, string[]>();
  const pairs: [string, string][] = [
    ['ko', 'en'],
    ['ko', 'ja'],
    ['en', 'ko'],
    ['en', 'ja'],
    ['ja', 'ko'],
    ['ja', 'en'],
  ];
  for (const [from, to] of pairs) {
    const key = `${from}-${to}`;
    linesByDirection.set(key, buildDirectionLines(rows, from, to));
  }
  return linesByDirection;
}

/**
 * DB에서 캐시 갱신. 실패 시 파일 폴백만 사용.
 */
export async function refreshTranslationCache(): Promise<void> {
  const guidelines: Record<string, string> = {};
  let linesByDirection = new Map<string, string[]>();

  try {
    const dictRows = await prisma.translationDictionaryEntry.findMany({
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const triples: TripleRow[] = dictRows.map((r) => ({
      ko: r.ko,
      en: r.en,
      ja: r.ja,
    }));

    linesByDirection = fillLinesMap(triples);

    const guideRows = await prisma.translationGuideline.findMany();
    for (const g of guideRows) {
      guidelines[g.name] = g.content;
    }
  } catch (err) {
    console.warn('[Translation] DB cache load error:', err);
  }

  const koEnLines = linesByDirection.get('ko-en') ?? [];
  if (koEnLines.length === 0) {
    const fallbackRows = loadFallbackRowsFromFiles();
    if (fallbackRows.length) {
      linesByDirection = fillLinesMap(fallbackRows);
    }
  }

  if (Object.keys(guidelines).length === 0) {
    Object.assign(guidelines, loadGuidelinesFromFiles());
  }

  cache = { linesByDirection, guidelines };
}

export function invalidateTranslationCache(): void {
  cache = null;
}

export function getTranslationCache(): TranslationCache | null {
  return cache;
}

export async function ensureTranslationCache(): Promise<TranslationCache> {
  if (!cache) {
    await refreshTranslationCache();
  }
  return cache!;
}

export function getDictionaryLinesForTranslation(fromLang: string, toLang: string): string[] {
  const key = `${fromLang}-${toLang}`;
  if (!cache) return [];
  return cache.linesByDirection.get(key) ?? [];
}

export function getGuidelineTexts(names: string[]): string {
  if (!cache) return '';
  return names.map((n) => cache!.guidelines[n]).filter(Boolean).join('\n\n');
}
