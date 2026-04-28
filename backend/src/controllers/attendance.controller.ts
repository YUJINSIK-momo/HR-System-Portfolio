import { Response } from 'express';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { getTodayInSeoul, getLateDeadlineInSeoul } from '../lib/dateUtils';
import { isPartTimePosition } from '../lib/attendanceUtils';

const historyQuerySchema = z.object({
  userId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  year: z.string().optional(),
});

const checkInBodySchema = z.object({
  workLocation: z.enum(['OFFICE', 'OVERSEAS']).optional(),
});

const VALID_WORK_LOCATIONS = ['OFFICE', 'OVERSEAS'] as const;
type ValidWorkLocation = (typeof VALID_WORK_LOCATIONS)[number];

/** 해외 근무(출근) 1일당 연차 자동 차감 (구: 7회당 1일) */
const OVERSEAS_ANNUAL_DEDUCTION_PER_DAY = 0.2;

function parseWorkLocation(val: unknown): ValidWorkLocation {
  if (val === 'OFFICE' || val === 'OVERSEAS') return val;
  return 'OFFICE';
}

export const checkIn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = getTodayInSeoul();

    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const bodyResult = checkInBodySchema.safeParse(body);
    const workLocation = parseWorkLocation(bodyResult.success ? bodyResult.data.workLocation : undefined);

    const existing = await prisma.attendanceRecord.findUnique({
      where: { userId_date: { userId: req.user!.id, date: today } },
    });

    if (existing) {
      res.status(400).json({ message: '이미 출근 기록이 있습니다.' });
      return;
    }

    const checkInNow = new Date();
    const lateDeadline = getLateDeadlineInSeoul(today);
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: req.user!.id },
      select: { position: true },
    });
    const status =
      isPartTimePosition(profile?.position) ? 'NORMAL' : checkInNow > lateDeadline ? 'LATE' : 'NORMAL';

    const createData = {
      userId: req.user!.id,
      date: today,
      checkIn: checkInNow,
      status,
      workLocation,
    } as const;
    const record = await prisma.attendanceRecord.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: createData as any, // Prisma generate 미실행 시 workLocation 타입 미반영
    });

    // 해외 근무 출근 1일당 연차 0.2일 자동 소모 (잔여 부족 시 차감 생략)
    if (workLocation === 'OVERSEAS') {
      const annualPolicy = await prisma.leavePolicy.findUnique({ where: { name: '연차' } });
      if (annualPolicy) {
        const balance = await prisma.leaveBalance.findUnique({
          where: {
            userId_policyId_year: {
              userId: req.user!.id,
              policyId: annualPolicy.id,
              year: today.getFullYear(),
            },
          },
        });
        const deduct = OVERSEAS_ANNUAL_DEDUCTION_PER_DAY;
        const remaining = balance ? balance.totalDays - balance.usedDays : 0;
        if (balance && remaining + 1e-9 >= deduct) {
          await prisma.$transaction([
            prisma.leaveBalance.update({
              where: { id: balance.id },
              data: { usedDays: { increment: deduct } },
            }),
            prisma.leaveRequest.create({
              data: {
                userId: req.user!.id,
                type: 'ANNUAL',
                startDate: today,
                endDate: today,
                days: deduct,
                reason: `해외 근무 1일 (연차 ${deduct}일 자동 차감)`,
                status: 'APPROVED',
              },
            }),
          ]);
        }
      }
    }

    res.status(201).json(record);
  } catch (err: any) {
    console.error('[checkIn] 오류:', err);
    const msg = err?.message || err?.code || '알 수 없는 오류';
    res.status(500).json({ message: `출근 처리 중 오류가 발생했습니다. (${msg})` });
  }
};

export const checkOut = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = getTodayInSeoul();

    const record = await prisma.attendanceRecord.findUnique({
      where: { userId_date: { userId: req.user!.id, date: today } },
    });

    if (!record) {
      res.status(400).json({ message: '출근 기록이 없습니다.' });
      return;
    }

    if (record.checkOut) {
      res.status(400).json({ message: '이미 퇴근 기록이 있습니다.' });
      return;
    }

    const updated = await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: { checkOut: new Date() },
    });

    res.json(updated);
  } catch (err: any) {
    console.error('[checkOut] 오류:', err);
    res.status(500).json({ message: err?.message || '퇴근 처리 중 오류가 발생했습니다.' });
  }
};

export const getMyAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = getTodayInSeoul();

    const record = await prisma.attendanceRecord.findUnique({
      where: { userId_date: { userId: req.user!.id, date: today } },
    });

    res.json(record);
  } catch (err: any) {
    console.error('[getMyAttendance] 오류:', err);
    res.status(500).json({ message: err?.message || '오늘 근태 조회 중 오류가 발생했습니다.' });
  }
};

const updateAttendanceBodySchema = z.object({
  checkIn: z.string().optional().nullable(),
  checkOut: z.string().optional().nullable(),
}).refine(
  (d) => {
    if (d.checkIn && isNaN(Date.parse(d.checkIn))) return false;
    if (d.checkOut && isNaN(Date.parse(d.checkOut))) return false;
    return true;
  },
  { message: '올바른 날짜/시간 형식이 아닙니다.' }
);

export const updateAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = updateAttendanceBodySchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: result.error.errors[0]?.message || '잘못된 요청입니다.' });
      return;
    }

    const record = await prisma.attendanceRecord.findUnique({ where: { id } });
    if (!record) {
      res.status(404).json({ message: '근태 기록을 찾을 수 없습니다.' });
      return;
    }

    const data: { checkIn?: Date | null; checkOut?: Date | null; status?: 'NORMAL' | 'LATE' } = {};
    if (result.data.checkIn !== undefined) data.checkIn = result.data.checkIn ? new Date(result.data.checkIn) : null;
    if (result.data.checkOut !== undefined) data.checkOut = result.data.checkOut ? new Date(result.data.checkOut) : null;

    if (result.data.checkIn !== undefined && data.checkIn) {
      const dayStart = new Date(record.date.toISOString().slice(0, 10) + 'T00:00:00.000Z');
      const lateDeadline = getLateDeadlineInSeoul(dayStart);
      const profile = await prisma.employeeProfile.findUnique({
        where: { userId: record.userId },
        select: { position: true },
      });
      data.status = isPartTimePosition(profile?.position)
        ? ('NORMAL' as const)
        : data.checkIn > lateDeadline
          ? ('LATE' as const)
          : ('NORMAL' as const);
    }

    const updated = await prisma.attendanceRecord.update({
      where: { id },
      data: data as { checkIn?: Date | null; checkOut?: Date | null; status?: 'NORMAL' | 'LATE' },
    });
    res.json(updated);
  } catch (err: any) {
    console.error('[updateAttendance] 오류:', err);
    res.status(500).json({ message: err?.message || '근태 시간 수정 중 오류가 발생했습니다.' });
  }
};

export const resetAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const record = await prisma.attendanceRecord.findUnique({ where: { id } });
  if (!record) {
    res.status(404).json({ message: '근태 기록을 찾을 수 없습니다.' });
    return;
  }

  await prisma.attendanceRecord.delete({ where: { id } });

  res.json({ message: '근태 기록이 초기화되었습니다. 직원이 다시 출근 체크할 수 있습니다.' });
};

export const getAttendanceList = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = historyQuerySchema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({ message: '잘못된 요청입니다.' });
      return;
    }

    const { startDate, endDate } = result.data;

    const dateFilter =
      startDate && endDate
        ? { date: { gte: new Date(startDate), lte: new Date(endDate) } }
        : startDate
          ? { date: { gte: new Date(startDate) } }
          : endDate
            ? { date: { lte: new Date(endDate) } }
            : {};

    const records = await prisma.attendanceRecord.findMany({
      where: {
        userId: req.user!.id,
        ...dateFilter,
      },
      include: { user: { include: { profile: true } } },
      orderBy: { date: 'desc' },
    });

    res.json(records);
  } catch (err: any) {
    console.error('[getAttendanceList] 오류:', err);
    res.status(500).json({ message: err?.message || '근태 이력 조회 중 오류가 발생했습니다.' });
  }
};

/** 일반 근태 현황: FOREIGN_FREELANCER 제외 */
export const getAllAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  const result = historyQuerySchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ message: '잘못된 요청입니다.' });
    return;
  }

  const { userId, startDate, endDate } = result.data;

  const excludeUserIds = await prisma.user.findMany({
    where: { role: 'FOREIGN_FREELANCER' as any },
    select: { id: true },
  }).then((u) => u.map((x) => x.id));

  const dateFilter =
    startDate && endDate
      ? { date: { gte: new Date(startDate), lte: new Date(endDate) } }
      : startDate
        ? { date: { gte: new Date(startDate) } }
        : endDate
          ? { date: { lte: new Date(endDate) } }
          : {};

  const records = await prisma.attendanceRecord.findMany({
    where: {
      ...(excludeUserIds.length > 0 && { userId: { notIn: excludeUserIds } }),
      ...(userId && { userId }),
      ...dateFilter,
    },
    include: { user: { include: { profile: true } } },
    orderBy: { date: 'desc' },
  });

  res.json(records);
};

const statusLabel: Record<string, string> = { NORMAL: '정상', LATE: '지각', EARLY_LEAVE: '조퇴', ABSENT: '결근', ON_LEAVE: '휴가' };
const workLocationLabel: Record<string, string> = { OFFICE: '출근', OVERSEAS: '해외근무' };

/** 근태 기록 엑셀 출력 (관리자) - 년도별 12개월 시트, 직원별 월 근무시간 */
export const exportAttendanceToExcel = async (req: AuthRequest, res: Response): Promise<void> => {
  const result = historyQuerySchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ message: '잘못된 요청입니다.' });
    return;
  }

  const { userId, startDate, endDate, year } = result.data;
  const exportYear = year ? parseInt(year, 10) : (startDate ? new Date(startDate).getFullYear() : new Date().getFullYear());
  const yearStart = new Date(exportYear, 0, 1);
  const yearEnd = new Date(exportYear, 11, 31, 23, 59, 59);

  const excludeUserIds = await prisma.user.findMany({
    where: { role: 'FOREIGN_FREELANCER' as any },
    select: { id: true },
  }).then((u) => u.map((x) => x.id));

  const records = await prisma.attendanceRecord.findMany({
    where: {
      ...(excludeUserIds.length > 0 && { userId: { notIn: excludeUserIds } }),
      ...(userId && { userId }),
      date: { gte: yearStart, lte: yearEnd },
    },
    include: { user: { include: { profile: true } } },
    orderBy: { date: 'asc' },
  });

  const byUserMonth = new Map<string, Map<number, { days: number; hours: number }>>();
  records.forEach((r: any) => {
    const name = r.user?.profile?.name || r.user?.email || '';
    if (!name) return;
    const month = new Date(r.date).getMonth() + 1;
    const key = `${r.userId}|${name}`;
    if (!byUserMonth.has(key)) byUserMonth.set(key, new Map());
    const mm = byUserMonth.get(key)!;
    if (!mm.has(month)) mm.set(month, { days: 0, hours: 0 });
    const cell = mm.get(month)!;
    cell.days += 1;
    if (r.checkIn && r.checkOut) {
      const hrs = (new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / (1000 * 60 * 60);
      cell.hours += Math.round(hrs * 100) / 100;
    }
  });

  const sortedKeys = [...byUserMonth.keys()].sort((a, b) => a.split('|')[1].localeCompare(b.split('|')[1]));

  const wb = new ExcelJS.Workbook();
  wb.creator = '사내관리시스템';

  const applyHeaderStyle = (row: ExcelJS.Row) => {
    row.height = 22;
    row.eachCell((cell) => {
      cell.font = { bold: true, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } };
      cell.font = { ...cell.font, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
  };

  for (let m = 1; m <= 12; m++) {
    const ws = wb.addWorksheet(`${exportYear}년 ${m}월`, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = [
      { header: '직원', key: 'name', width: 18 },
      { header: '출근일수', key: 'days', width: 10 },
      { header: '총 근무시간(시간)', key: 'hours', width: 16 },
    ];
    const headerRow = ws.getRow(1);
    applyHeaderStyle(headerRow);

    sortedKeys.forEach((key) => {
      const [, name] = key.split('|');
      const mm = byUserMonth.get(key)!;
      const cell = mm.get(m) || { days: 0, hours: 0 };
      ws.addRow({ name, days: cell.days, hours: cell.hours > 0 ? cell.hours : '' });
    });

    ws.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell, colNumber) => {
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          if (colNumber >= 2) cell.alignment = { horizontal: 'center' };
          if (colNumber === 3 && rowNumber > 1) {
            const v = row.getCell(3).value as number | string;
            if (typeof v === 'number' && v > 0) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };
            }
          }
        });
      }
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  const fileName = `근태월별요약_${exportYear}년.xlsx`;
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(Buffer.from(buf));
};

/** 외국인 전용 근태 현황: FOREIGN_FREELANCER만 (디자이너·관리자용) */
export const getForeignFreelancerAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  const result = historyQuerySchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ message: '잘못된 요청입니다.' });
    return;
  }

  const { userId, startDate, endDate } = result.data;

  const ffUserIds = await prisma.user.findMany({
    where: { role: 'FOREIGN_FREELANCER' as any, isActive: true },
    select: { id: true },
  }).then((u) => u.map((x) => x.id));

  if (ffUserIds.length === 0) {
    res.json([]);
    return;
  }

  const dateFilter =
    startDate && endDate
      ? { date: { gte: new Date(startDate), lte: new Date(endDate) } }
      : startDate
        ? { date: { gte: new Date(startDate) } }
        : endDate
          ? { date: { lte: new Date(endDate) } }
          : {};

  const records = await prisma.attendanceRecord.findMany({
    where: {
      userId: { in: ffUserIds },
      ...(userId && { userId }),
      ...dateFilter,
    },
    include: { user: { include: { profile: true } } },
    orderBy: { date: 'desc' },
  });

  res.json(records);
};
