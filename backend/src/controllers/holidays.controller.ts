import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { getYearInSeoul } from '../lib/dateUtils';
import { syncHolidaysFromDataGoKr } from '../services/holidays.service';

export const getHolidays = async (req: Request, res: Response): Promise<void> => {
  const { start, end } = req.query;
  const year = getYearInSeoul();
  const startDate = start ? new Date(start as string) : new Date(Date.UTC(year, 0, 1));
  const endDate = end ? new Date(end as string) : new Date(Date.UTC(year, 11, 31));

  const holidays = await prisma.holiday.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { date: 'asc' },
  });

  // 클라이언트 타임존 이슈 방지: date를 YYYY-MM-DD 문자열로 반환
  res.json(holidays.map((h) => ({
    id: h.id,
    date: h.date.toISOString().slice(0, 10),
    name: h.name,
    isCompany: h.isCompany,
  })));
};

/**
 * 공공데이터포털 API로 공휴일 동기화 (관리자 전용)
 * POST /holidays/sync
 * Body: { startYear?: number, endYear?: number } (기본: 현재 연도 ±2년)
 */
export const syncHolidays = async (req: Request, res: Response): Promise<void> => {
  const currentYear = getYearInSeoul();
  const startYear = Math.max(2024, (req.body?.startYear as number) ?? currentYear - 2);
  const endYear = Math.min(2030, (req.body?.endYear as number) ?? currentYear + 2);

  if (startYear > endYear) {
    res.status(400).json({ message: 'startYear는 endYear보다 작거나 같아야 합니다.' });
    return;
  }

  try {
    const result = await syncHolidaysFromDataGoKr(startYear, endYear);
    res.json({
      message: `공휴일 동기화 완료 (${startYear}~${endYear})`,
      deleted: result.deleted,
      created: result.created,
      updated: result.updated,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ message: `공휴일 동기화 실패: ${msg}` });
  }
};
