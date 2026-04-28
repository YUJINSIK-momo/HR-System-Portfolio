/**
 * 공공데이터포털 특일정보 API (SpcdeInfoService) 연동
 * - getRestDeInfo: 공휴일 정보 조회 (대체공휴일 포함)
 * - getHoliDeInfo: 국경일 정보 조회
 */
import { XMLParser } from 'fast-xml-parser';
import prisma from '../lib/prisma';

const BASE_URL = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService';

interface SpcdeItem {
  locdate?: string;     // YYYYMMDD
  dateName?: string;
  isHoliday?: string;   // Y | N
  seq?: string;
  dateKind?: string;
}

interface SpcdeResponse {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: {
      items?: { item?: SpcdeItem | SpcdeItem[] };
      totalCount?: number;
    };
  };
}

function parseItems(data: SpcdeResponse): SpcdeItem[] {
  const items = data?.response?.body?.items?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

async function fetchRestDeInfo(year: number, month: number): Promise<SpcdeItem[]> {
  const key = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!key) {
    throw new Error('DATA_GO_KR_SERVICE_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.');
  }

  const monthStr = String(month).padStart(2, '0');
  const url = new URL(`${BASE_URL}/getRestDeInfo`);
  url.searchParams.set('serviceKey', key);
  url.searchParams.set('solYear', String(year));
  url.searchParams.set('solMonth', monthStr);
  url.searchParams.set('numOfRows', '100');
  url.searchParams.set('pageNo', '1');

  const res = await fetch(url.toString());
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`공공데이터 API 호출 실패 (${res.status}): ${text.slice(0, 200)}`);
  }

  const parser = new XMLParser({ ignoreAttributes: true });
  const parsed = parser.parse(text) as SpcdeResponse;

  const resultCode = parsed?.response?.header?.resultCode;
  if (resultCode && resultCode !== '00') {
    const msg = parsed?.response?.header?.resultMsg || '알 수 없는 오류';
    throw new Error(`공공데이터 API 오류 (${resultCode}): ${msg}`);
  }

  return parseItems(parsed);
}

/** locdate(YYYYMMDD)를 Date로 변환 - UTC로 저장해 서버 타임존에 영향받지 않음 */
function locdateToDate(locdate: string): Date {
  const y = parseInt(locdate.slice(0, 4), 10);
  const m = parseInt(locdate.slice(4, 6), 10) - 1;
  const d = parseInt(locdate.slice(6, 8), 10);
  return new Date(Date.UTC(y, m, d));
}

/**
 * 공공데이터 API로 공휴일을 가져와 DB에 저장
 * - 동기화 범위 내 기존 공휴일(잘못된 seed 데이터 등)을 먼저 삭제 후 API 데이터로 채움
 * @param startYear 시작 연도
 * @param endYear 종료 연도
 */
export async function syncHolidaysFromDataGoKr(
  startYear: number,
  endYear: number
): Promise<{ created: number; updated: number; deleted: number; errors: string[] }> {
  const errors: string[] = [];
  let created = 0;
  let updated = 0;

  // 동기화 범위 내 기존 공휴일 삭제 (이전 seed 타임존 오류로 생긴 잘못된 데이터 제거)
  const rangeStart = new Date(Date.UTC(startYear, 0, 1));
  const rangeEnd = new Date(Date.UTC(endYear, 11, 31, 23, 59, 59, 999));
  const deleteResult = await prisma.holiday.deleteMany({
    where: {
      date: { gte: rangeStart, lte: rangeEnd },
      isCompany: false, // 회사 지정 휴일은 유지
    },
  });
  const deleted = deleteResult.count;

  for (let year = startYear; year <= endYear; year++) {
    for (let month = 1; month <= 12; month++) {
      try {
        const items = await fetchRestDeInfo(year, month);
        await new Promise((r) => setTimeout(r, 100));

        for (const item of items) {
          // locdate: XML 파서가 숫자(20250505)로 반환할 수 있음
          const locdateRaw = item.locdate;
          const locdate = typeof locdateRaw === 'number'
            ? String(locdateRaw).padStart(8, '0')
            : String(locdateRaw || '').trim();
          const name = (typeof item.dateName === 'string' ? item.dateName : String(item.dateName || '')).trim() || '공휴일';
          if (!locdate || locdate.length !== 8) continue;

          // isHoliday가 Y인 경우만 저장 (공휴일만)
          if (String(item.isHoliday || '').toUpperCase() !== 'Y') continue;

          const date = locdateToDate(locdate);

          const existing = await prisma.holiday.findUnique({
            where: { date },
          });

          if (existing) {
            // 같은 날 여러 공휴일(어린이날/부처님오신날 등) → 이름 병합
            const merged = [existing.name, name].filter(Boolean);
            const uniqueNames = [...new Set(merged.flatMap((s) => s.split(/[\/,]/)).map((s) => s.trim()))];
            const newName = uniqueNames.join('/').replace(/\s*\|\s*/g, '/') || name;
            await prisma.holiday.update({
              where: { date },
              data: { name: newName },
            });
            updated++;
          } else {
            await prisma.holiday.create({
              data: {
                date,
                name,
                isCompany: false,
              },
            });
            created++;
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${year}-${String(month).padStart(2, '0')}: ${msg}`);
      }
    }
  }

  return { created, updated, deleted, errors };
}
