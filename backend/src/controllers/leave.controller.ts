import { Response } from 'express';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const leaveExportQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  year: z.string().optional(),
});

const LEAVE_TYPE_LABELS: Record<string, string> = {
  ANNUAL: '연차',
  HALF_DAY_AM: '오전 반차',
  HALF_DAY_PM: '오후 반차',
  QUARTER_DAY: '반반차',
  SICK: '병결',
  OFFICIAL: '공가',
  FAMILY: '경조휴가',
};

const LEAVE_STATUS_LABELS: Record<string, string> = {
  PENDING: '대기',
  APPROVED: '승인',
  REJECTED: '반려',
};

const familySubTypeSchema = z.enum([
  'OWN_MARRIAGE',
  'CHILD_MARRIAGE',
  'SPOUSE_CHILDBIRTH',
  'PARENT_DEATH',
  'GRANDPARENT_DEATH',
  'SIBLING_DEATH',
]);

/** 경조 유형별 부여 영업일 수 (주말·공휴일 제외한 일수와 동일) */
const FAMILY_SUBTYPE_BUSINESS_DAYS: Record<string, number> = {
  OWN_MARRIAGE: 5,
  CHILD_MARRIAGE: 1,
  SPOUSE_CHILDBIRTH: 10,
  PARENT_DEATH: 5,
  GRANDPARENT_DEATH: 2,
  SIBLING_DEATH: 2,
};

const leaveRequestSchema = z.object({
  type: z.enum(['ANNUAL', 'HALF_DAY_AM', 'HALF_DAY_PM', 'QUARTER_DAY', 'SICK', 'OFFICIAL', 'FAMILY']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  days: z.number().min(0.25).max(1).multipleOf(0.25).optional(),
  reason: z.string().optional(),
  familySubType: familySubTypeSchema.optional(),
}).refine(
  (data) => {
    if (data.type === 'QUARTER_DAY') {
      return data.days !== undefined && [0.25, 0.75].includes(data.days) && !!data.startDate;
    }
    if (data.type === 'FAMILY') {
      return !!data.startDate && !!data.familySubType;
    }
    return !!(data.startDate && data.endDate);
  },
  { message: '반반차는 날짜와 일수(0.25 또는 0.75)를, 경조휴가는 시작일과 경조 유형을, 그 외는 기간을 입력해주세요.' }
);

function isBusinessDayUtc(d: Date, holidayKeys: Set<string>): boolean {
  const key = toDateKey(d);
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  if (holidayKeys.has(key)) return false;
  return true;
}

/** 시작일(포함)부터 n번째 영업일까지의 종료일(포함). 주말·공휴일은 건너뜀. */
function computeFamilyLeaveEndInclusive(start: Date, businessDaysInclusive: number, holidayKeys: Set<string>): Date {
  let remaining = businessDaysInclusive;
  let current = new Date(start.getTime());
  let lastBusiness = new Date(current.getTime());
  const maxIter = 800;
  let iter = 0;
  while (remaining > 0 && iter < maxIter) {
    iter += 1;
    if (isBusinessDayUtc(current, holidayKeys)) {
      remaining -= 1;
      lastBusiness = new Date(current.getTime());
    }
    if (remaining > 0) {
      current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    }
  }
  return lastBusiness;
}

function toDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** YYYY-MM-DD를 Date로 파싱 (타임존 밀림 방지: 정오 UTC 사용) */
function parseDateOnly(s: string): Date {
  return new Date(s + 'T12:00:00.000Z');
}

export const requestLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  const result = leaveRequestSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: result.error.errors[0].message });
    return;
  }

  const { type, startDate, endDate, days: reqDays, reason, familySubType } = result.data;

  let start: Date;
  let end: Date;
  let days: number;

  if (type === 'QUARTER_DAY') {
    days = reqDays!;
    if (!startDate) {
      res.status(400).json({ message: '시작일을 입력해주세요.' });
      return;
    }
    start = parseDateOnly(startDate);
    end = new Date(start.getTime());
  } else if (type === 'FAMILY') {
    if (!startDate || !familySubType) {
      res.status(400).json({ message: '시작일과 경조 유형을 선택해주세요.' });
      return;
    }
    const businessDays = FAMILY_SUBTYPE_BUSINESS_DAYS[familySubType];
    if (!businessDays) {
      res.status(400).json({ message: '유효하지 않은 경조 유형입니다.' });
      return;
    }
    start = parseDateOnly(startDate);
    const y = start.getUTCFullYear();
    const holidaysInRange = await prisma.holiday.findMany({
      where: {
        date: {
          gte: new Date(Date.UTC(y, 0, 1)),
          lte: new Date(Date.UTC(y + 2, 11, 31)),
        },
      },
    });
    const holidayKeys = new Set(holidaysInRange.map((h) => toDateKey(new Date(h.date))));
    if (!isBusinessDayUtc(start, holidayKeys)) {
      res.status(400).json({
        message: '경조휴가 시작일은 근무일(토·일·공휴일 제외)을 선택해주세요.',
      });
      return;
    }
    end = computeFamilyLeaveEndInclusive(start, businessDays, holidayKeys);
    days = businessDays;
  } else {
    if (!startDate || !endDate) {
      res.status(400).json({ message: '시작일과 종료일을 입력해주세요.' });
      return;
    }
    start = parseDateOnly(startDate);
    end = parseDateOnly(endDate);

    const isHalfDay = type === 'HALF_DAY_AM' || type === 'HALF_DAY_PM';

    if (isHalfDay) {
      const holidaysInRange = await prisma.holiday.findMany({
        where: {
          date: {
            gte: new Date(startDate + 'T00:00:00.000Z'),
            lte: new Date(startDate + 'T23:59:59.999Z'),
          },
        },
      });
      const startKey = toDateKey(start);
      const isHoliday = holidaysInRange.some((h) => toDateKey(new Date(h.date)) === startKey);
      const dayOfWeek = start.getUTCDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      days = isHoliday || isWeekend ? 0 : 0.5;
    } else {
      const holidaysInRange = await prisma.holiday.findMany({
        where: {
          date: {
            gte: new Date(startDate + 'T00:00:00.000Z'),
            lte: new Date(endDate + 'T23:59:59.999Z'),
          },
        },
      });
      const holidayKeys = new Set(holidaysInRange.map((h) => toDateKey(new Date(h.date))));

      let workDays = 0;
      let iter = new Date(start.getTime());
      const endD = new Date(end.getTime());
      while (iter <= endD) {
        const key = toDateKey(iter);
        const dayOfWeek = iter.getUTCDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isHoliday = holidayKeys.has(key);
        if (!isHoliday && !isWeekend) workDays += 1;
        iter = new Date(iter.getTime() + 24 * 60 * 60 * 1000);
      }
      days = workDays;
    }
  }

  if (days <= 0) {
    res.status(400).json({
      message: '선택한 기간에 근무일이 없습니다. 공휴일·주말(토·일)은 연차에서 제외됩니다.',
    });
    return;
  }

  const year = start.getUTCFullYear();
  const isFreelancer = req.user!.role === 'FOREIGN_FREELANCER';
  const policyName = isFreelancer ? '프리랜서연차' : '연차';
  const annualPolicy = await prisma.leavePolicy.findUnique({ where: { name: policyName } });
  if (annualPolicy && ['ANNUAL', 'HALF_DAY_AM', 'HALF_DAY_PM', 'QUARTER_DAY'].includes(type)) {
    const balance = await prisma.leaveBalance.findUnique({
      where: {
        userId_policyId_year: { userId: req.user!.id, policyId: annualPolicy.id, year },
      },
    });
    const remaining = balance ? balance.totalDays - balance.usedDays : 0;
    if (remaining < days) {
      res.status(400).json({ message: `연차가 부족합니다. (잔여 ${remaining}일, 필요 ${days}일)` });
      return;
    }
  }

  const leaveRequest = await prisma.leaveRequest.create({
    data: {
      userId: req.user!.id,
      type: type as never,
      startDate: start,
      endDate: end,
      days,
      reason: type === 'FAMILY' ? null : reason ?? null,
      familySubType: type === 'FAMILY' && familySubType ? (familySubType as never) : null,
      status: 'PENDING',
    },
  });

  res.status(201).json(leaveRequest);
};

export const getMyLeaveBalance = async (req: AuthRequest, res: Response): Promise<void> => {
  const year = new Date().getFullYear();

  const balances = await prisma.leaveBalance.findMany({
    where: { userId: req.user!.id, year },
    include: { policy: true },
  });

  res.json(balances);
};

export const getMyLeaveRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  const requests = await prisma.leaveRequest.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
  });

  res.json(requests);
};

export const getAllLeaveRequests = async (_req: AuthRequest, res: Response): Promise<void> => {
  const requests = await prisma.leaveRequest.findMany({
    where: { user: { role: { not: 'FOREIGN_FREELANCER' } } },
    include: { user: { include: { profile: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.json(requests);
};

/** 프리랜서 휴가 신청만 반환 (DESIGNER/MANAGER/SUPER_ADMIN/CS총괄용) */
export const getFreelancerLeaveRequests = async (_req: AuthRequest, res: Response): Promise<void> => {
  const requests = await prisma.leaveRequest.findMany({
    where: { user: { role: 'FOREIGN_FREELANCER' } },
    include: { user: { include: { profile: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.json(requests);
};

/** 스케줄 화면용: 기간 내 승인된 연차 목록 (날짜별 담당자 연차 표시) */
export const getApprovedLeavesForSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  const { start, end } = req.query;
  const startDate = start ? new Date(start as string) : new Date();
  const endDate = end ? new Date(end as string) : new Date();

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      status: 'APPROVED',
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    include: { user: { include: { profile: true } } },
    orderBy: { startDate: 'asc' },
  });

  res.json(leaves.map((l) => ({
    id: l.id,
    userId: l.userId,
    userName: l.user.profile?.name || l.user.email,
    type: l.type,
    startDate: l.startDate.toISOString().slice(0, 10),
    endDate: l.endDate.toISOString().slice(0, 10),
    days: l.days,
  })));
};

/** 연차 잔여 현황 엑셀 출력 (관리자) - 년도별 시트, 직원별 잔여 연차 */
export const exportLeaveToExcel = async (req: AuthRequest, res: Response): Promise<void> => {
  const result = leaveExportQuerySchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ message: '잘못된 요청입니다.' });
    return;
  }

  const { startDate, endDate, year } = result.data;
  const currentYear = new Date().getFullYear();
  let years: number[] = [];
  if (year) {
    years = [parseInt(year, 10)];
  } else if (startDate && endDate) {
    const y1 = new Date(startDate).getFullYear();
    const y2 = new Date(endDate).getFullYear();
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) years.push(y);
  }
  if (years.length === 0) years = [currentYear - 1, currentYear, currentYear + 1];

  const excludeUserIds = await prisma.user.findMany({
    where: { role: 'FOREIGN_FREELANCER' as any },
    select: { id: true },
  }).then((u) => u.map((x) => x.id));

  const [users, balances, annualPolicy] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, ...(excludeUserIds.length > 0 && { id: { notIn: excludeUserIds } }) },
      include: { profile: true },
    }),
    prisma.leaveBalance.findMany({
      where: { year: { in: years } },
      include: { user: { include: { profile: true } }, policy: true },
    }),
    prisma.leavePolicy.findUnique({ where: { name: '연차' } }),
  ]);

  const policyId = annualPolicy?.id;

  const wb = new ExcelJS.Workbook();
  wb.creator = '사내관리시스템';

  const applyHeaderStyle = (row: ExcelJS.Row) => {
    row.height = 24;
    row.eachCell((cell) => {
      cell.font = { bold: true, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
      cell.font = { ...cell.font, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
  };

  for (const y of years) {
    const ws = wb.addWorksheet(`${y}년`, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = [
      { header: '직원', key: 'name', width: 18 },
      { header: '총 연차', key: 'total', width: 10 },
      { header: '사용 연차', key: 'used', width: 10 },
      { header: '잔여 연차', key: 'remaining', width: 10 },
    ];
    const headerRow = ws.getRow(1);
    applyHeaderStyle(headerRow);

    const balanceMap = new Map<string, { total: number; used: number }>();
    balances.filter((b: any) => b.year === y && (!policyId || b.policyId === policyId)).forEach((b: any) => {
      balanceMap.set(b.userId, { total: b.totalDays, used: b.usedDays });
    });

    const sortedUsers = [...users].sort((a, b) => (a.profile?.name || a.email).localeCompare(b.profile?.name || b.email));
    sortedUsers.forEach((u) => {
      const bal = balanceMap.get(u.id) || { total: 0, used: 0 };
      const remaining = Math.round((bal.total - bal.used) * 100) / 100;
      ws.addRow({
        name: u.profile?.name || u.email || '',
        total: bal.total,
        used: bal.used,
        remaining,
      });
    });

    ws.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell, colNumber) => {
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          if (colNumber >= 2) cell.alignment = { horizontal: 'center' };
          if (colNumber === 4 && rowNumber > 1) {
            const v = row.getCell(4).value as number;
            if (v > 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
          }
        });
      }
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  const fileName = `연차잔여현황_${years[0]}_${years[years.length - 1]}.xlsx`;
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(Buffer.from(buf));
};

export const getLeaveNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  const currentUser = await prisma.user.findUnique({
    where: { id: req.user!.id },
  });

  if (!currentUser) {
    res.json([]);
    return;
  }

  /** 해외 디자이너(프리랜서)는 연차 알림 미수신 */
  if (currentUser.role === 'FOREIGN_FREELANCER') {
    res.json([]);
    return;
  }

  const requests = await prisma.leaveRequest.findMany({
    include: { user: { include: { profile: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const filtered = requests.filter((r) => r.userId !== req.user!.id);

  res.json(filtered);
};

export const approveLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const leaveRequest = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!leaveRequest) {
    res.status(404).json({ message: '휴가 신청을 찾을 수 없습니다.' });
    return;
  }

  if (leaveRequest.status !== 'PENDING') {
    res.status(400).json({ message: '대기 중인 신청만 승인할 수 있습니다.' });
    return;
  }

  const leaveUser = await prisma.user.findUnique({ where: { id: leaveRequest.userId } });
  const isFreelancer = leaveUser?.role === 'FOREIGN_FREELANCER';
  const policyName = isFreelancer ? '프리랜서연차' : '연차';
  const year = new Date(leaveRequest.startDate).getFullYear();
  const annualPolicy = await prisma.leavePolicy.findUnique({ where: { name: policyName } });
  if (annualPolicy) {
    const balance = await prisma.leaveBalance.findUnique({
      where: {
        userId_policyId_year: {
          userId: leaveRequest.userId,
          policyId: annualPolicy.id,
          year,
        },
      },
    });
    const consumesAnnual = ['ANNUAL', 'HALF_DAY_AM', 'HALF_DAY_PM', 'QUARTER_DAY'].includes(leaveRequest.type);
    if (balance && consumesAnnual) {
      await prisma.leaveBalance.update({
        where: { id: balance.id },
        data: { usedDays: { increment: leaveRequest.days } },
      });
    }
  }

  await prisma.leaveRequest.update({
    where: { id },
    data: {
      status: 'APPROVED',
      approvedBy: req.user!.id,
      approvedAt: new Date(),
    },
  });

  res.json({ message: '휴가 신청이 승인되었습니다.' });
};

export const rejectLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const leaveRequest = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!leaveRequest) {
    res.status(404).json({ message: '휴가 신청을 찾을 수 없습니다.' });
    return;
  }

  if (leaveRequest.status !== 'PENDING') {
    res.status(400).json({ message: '대기 중인 신청만 반려할 수 있습니다.' });
    return;
  }

  await prisma.leaveRequest.update({
    where: { id },
    data: { status: 'REJECTED' },
  });

  res.json({ message: '휴가 신청이 반려되었습니다.' });
};

export const revokeLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const leaveRequest = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!leaveRequest) {
    res.status(404).json({ message: '휴가 신청을 찾을 수 없습니다.' });
    return;
  }

  if (leaveRequest.status !== 'APPROVED') {
    res.status(400).json({ message: '승인된 신청만 취소(반려)할 수 있습니다.' });
    return;
  }

  const leaveUser = await prisma.user.findUnique({ where: { id: leaveRequest.userId } });
  const isFreelancer = leaveUser?.role === 'FOREIGN_FREELANCER';
  const policyName = isFreelancer ? '프리랜서연차' : '연차';
  const year = new Date(leaveRequest.startDate).getFullYear();
  const annualPolicy = await prisma.leavePolicy.findUnique({ where: { name: policyName } });
  if (annualPolicy) {
    const balance = await prisma.leaveBalance.findUnique({
      where: {
        userId_policyId_year: {
          userId: leaveRequest.userId,
          policyId: annualPolicy.id,
          year,
        },
      },
    });
    const consumesAnnual = ['ANNUAL', 'HALF_DAY_AM', 'HALF_DAY_PM', 'QUARTER_DAY'].includes(leaveRequest.type);
    if (balance && consumesAnnual) {
      await prisma.leaveBalance.update({
        where: { id: balance.id },
        data: { usedDays: { decrement: leaveRequest.days } },
      });
    }
  }

  await prisma.leaveRequest.update({
    where: { id },
    data: {
      status: 'REJECTED',
      approvedBy: null,
      approvedAt: null,
    },
  });

  res.json({ message: '승인이 취소되었습니다.' });
};
