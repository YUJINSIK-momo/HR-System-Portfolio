import { Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { getLateDeadlineInSeoul, getTodayInSeoul } from '../lib/dateUtils';
import { isPartTimePosition } from '../lib/attendanceUtils';

const OVERSEAS_ANNUAL_DEDUCTION_PER_DAY = 0.2;

const createBodySchema = z
  .object({
    kind: z.enum(['ADD_MISSING', 'EDIT_TIMES']),
    workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    attendanceRecordId: z.string().uuid().optional(),
    proposedCheckIn: z.string().optional().nullable(),
    proposedCheckOut: z.string().optional().nullable(),
    workLocation: z.enum(['OFFICE', 'OVERSEAS']).optional(),
    reason: z.string().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    const hasIn = !!(data.proposedCheckIn && data.proposedCheckIn.trim());
    const hasOut = !!(data.proposedCheckOut && data.proposedCheckOut.trim());
    if (!hasIn && !hasOut) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '수정할 출근 또는 퇴근 시각을 하나 이상 입력해 주세요.',
        path: ['proposedCheckIn'],
      });
    }
    if (data.kind === 'EDIT_TIMES' && !data.attendanceRecordId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '시간 수정 신청에는 근태 기록이 필요합니다.',
        path: ['attendanceRecordId'],
      });
    }
    if (data.kind === 'ADD_MISSING' && data.attendanceRecordId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '누락 보정 신청에는 기존 기록 ID를 넣지 않습니다.',
        path: ['attendanceRecordId'],
      });
    }
  });

function parseIsoDate(s: string | null | undefined): Date | null {
  if (!s || !s.trim()) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

async function computeCheckInStatus(
  userId: string,
  recordDate: Date,
  checkIn: Date
): Promise<'NORMAL' | 'LATE'> {
  const dayStart = new Date(recordDate.toISOString().slice(0, 10) + 'T00:00:00.000Z');
  const lateDeadline = getLateDeadlineInSeoul(dayStart);
  const profile = await prisma.employeeProfile.findUnique({
    where: { userId },
    select: { position: true },
  });
  return isPartTimePosition(profile?.position) ? 'NORMAL' : checkIn > lateDeadline ? 'LATE' : 'NORMAL';
}

async function applyOverseasDeductionIfNeeded(userId: string, workDate: Date): Promise<void> {
  const annualPolicy = await prisma.leavePolicy.findUnique({ where: { name: '연차' } });
  if (!annualPolicy) return;
  const balance = await prisma.leaveBalance.findUnique({
    where: {
      userId_policyId_year: {
        userId,
        policyId: annualPolicy.id,
        year: workDate.getUTCFullYear(),
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
          userId,
          type: 'ANNUAL',
          startDate: workDate,
          endDate: workDate,
          days: deduct,
          reason: `해외 근무 1일 (연차 ${deduct}일 자동 차감)`,
          status: 'APPROVED',
        },
      }),
    ]);
  }
}

export const createAttendanceCorrectionRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = createBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.errors[0]?.message || '잘못된 요청입니다.' });
    return;
  }

  const { kind, workDate: workDateStr, attendanceRecordId, proposedCheckIn, proposedCheckOut, workLocation, reason } =
    parsed.data;
  const workDate = new Date(workDateStr + 'T00:00:00.000Z');
  const today = getTodayInSeoul();

  const pIn = parseIsoDate(proposedCheckIn ?? undefined);
  const pOut = parseIsoDate(proposedCheckOut ?? undefined);
  if (proposedCheckIn && proposedCheckIn.trim() && !pIn) {
    res.status(400).json({ message: '출근 시각 형식이 올바르지 않습니다.' });
    return;
  }
  if (proposedCheckOut && proposedCheckOut.trim() && !pOut) {
    res.status(400).json({ message: '퇴근 시각 형식이 올바르지 않습니다.' });
    return;
  }

  if (kind === 'ADD_MISSING') {
    if (workDate >= today) {
      res.status(400).json({
        message: '출퇴근 누락 보정은 오늘 이전 날짜만 신청할 수 있습니다. 당일은 출근/퇴근 버튼을 이용해 주세요.',
      });
      return;
    }

    const existing = await prisma.attendanceRecord.findUnique({
      where: { userId_date: { userId: req.user!.id, date: workDate } },
    });
    if (existing) {
      res.status(400).json({
        message: '해당 날짜에 이미 근태 기록이 있습니다. 시간 수정 신청을 이용해 주세요.',
      });
      return;
    }

    const dup = await prisma.attendanceCorrectionRequest.findFirst({
      where: {
        userId: req.user!.id,
        status: 'PENDING',
        kind: 'ADD_MISSING',
        workDate,
      },
    });
    if (dup) {
      res.status(400).json({ message: '같은 날짜의 누락 보정 신청이 이미 대기 중입니다.' });
      return;
    }

    if (!pIn && !pOut) {
      res.status(400).json({ message: '출근 또는 퇴근 시각을 입력해 주세요.' });
      return;
    }
    if (pIn && pOut && pOut <= pIn) {
      res.status(400).json({ message: '퇴근 시각은 출근 시각보다 이후여야 합니다.' });
      return;
    }

    const wl = workLocation ?? 'OFFICE';

    const created = await prisma.attendanceCorrectionRequest.create({
      data: {
        userId: req.user!.id,
        kind: 'ADD_MISSING',
        workDate,
        proposedCheckIn: pIn,
        proposedCheckOut: pOut,
        workLocation: wl,
        reason: reason?.trim() || null,
      },
      include: { user: { include: { profile: true } } },
    });
    res.status(201).json(created);
    return;
  }

  // EDIT_TIMES
  if (!attendanceRecordId) {
    res.status(400).json({ message: '근태 기록 ID가 필요합니다.' });
    return;
  }

  const record = await prisma.attendanceRecord.findUnique({ where: { id: attendanceRecordId } });
  if (!record || record.userId !== req.user!.id) {
    res.status(404).json({ message: '근태 기록을 찾을 수 없습니다.' });
    return;
  }

  const recordDay = new Date(record.date).toISOString().slice(0, 10);
  if (recordDay !== workDateStr) {
    res.status(400).json({ message: '선택한 날짜와 근태 기록의 날짜가 일치하지 않습니다.' });
    return;
  }

  const dup = await prisma.attendanceCorrectionRequest.findFirst({
    where: {
      userId: req.user!.id,
      status: 'PENDING',
      kind: 'EDIT_TIMES',
      attendanceRecordId,
    },
  });
  if (dup) {
    res.status(400).json({ message: '이 근태 기록에 대한 수정 신청이 이미 대기 중입니다.' });
    return;
  }

  const mergedIn = pIn ?? record.checkIn;
  const mergedOut = pOut ?? record.checkOut;
  if (mergedIn && mergedOut && mergedOut <= mergedIn) {
    res.status(400).json({ message: '퇴근 시각은 출근 시각보다 이후여야 합니다.' });
    return;
  }
  if (!mergedIn && !mergedOut) {
    res.status(400).json({ message: '출근·퇴근 시각이 모두 비어 있으면 안 됩니다.' });
    return;
  }

  const created = await prisma.attendanceCorrectionRequest.create({
    data: {
      userId: req.user!.id,
      kind: 'EDIT_TIMES',
      workDate,
      attendanceRecordId,
      proposedCheckIn: pIn,
      proposedCheckOut: pOut,
      workLocation: record.workLocation,
      reason: reason?.trim() || null,
    },
    include: { user: { include: { profile: true } }, attendanceRecord: true },
  });
  res.status(201).json(created);
};

export const getMyAttendanceCorrectionRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  const list = await prisma.attendanceCorrectionRequest.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    include: { attendanceRecord: true },
  });
  res.json(list);
};

const adminQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
});

/** 일반 근태 현황: FOREIGN_FREELANCER 제외 (getAllAttendance 와 동일 구분) */
export const getAllAttendanceCorrectionRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  const q = adminQuerySchema.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ message: '잘못된 요청입니다.' });
    return;
  }

  const list = await prisma.attendanceCorrectionRequest.findMany({
    where: {
      ...(q.data.status && { status: q.data.status }),
      user: { role: { not: 'FOREIGN_FREELANCER' as any } },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      user: { include: { profile: true } },
      attendanceRecord: true,
    },
  });
  res.json(list);
};

/** 프리랜서 근태 현황: FOREIGN_FREELANCER 신청만 */
export const getForeignFreelancerAttendanceCorrectionRequests = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const q = adminQuerySchema.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ message: '잘못된 요청입니다.' });
    return;
  }

  const list = await prisma.attendanceCorrectionRequest.findMany({
    where: {
      ...(q.data.status && { status: q.data.status }),
      user: { role: 'FOREIGN_FREELANCER' as any },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      user: { include: { profile: true } },
      attendanceRecord: true,
    },
  });
  res.json(list);
};

/** 디자이너는 외국 프리랜서 신청만 승인·반려 (일반 직원 보정은 관리자·CS총괄) */
function assertDesignerFreelancerCorrectionApplicant(
  req: AuthRequest,
  applicantRole: string | undefined,
  res: Response
): boolean {
  if (req.user!.role !== 'DESIGNER') return true;
  if (applicantRole === 'FOREIGN_FREELANCER') return true;
  res.status(403).json({ message: '외국 프리랜서 근태 보정만 처리할 수 있습니다.' });
  return false;
}

export const approveAttendanceCorrectionRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const requestRow = await prisma.attendanceCorrectionRequest.findUnique({
    where: { id },
    include: {
      attendanceRecord: true,
      user: { select: { role: true } },
    },
  });

  if (!requestRow) {
    res.status(404).json({ message: '신청을 찾을 수 없습니다.' });
    return;
  }
  if (requestRow.status !== 'PENDING') {
    res.status(400).json({ message: '대기 중인 신청만 승인할 수 있습니다.' });
    return;
  }
  if (!assertDesignerFreelancerCorrectionApplicant(req, requestRow.user?.role, res)) {
    return;
  }

  const uid = requestRow.userId;
  const wd = requestRow.workDate;

  try {
    if (requestRow.kind === 'ADD_MISSING') {
      const existing = await prisma.attendanceRecord.findUnique({
        where: { userId_date: { userId: uid, date: wd } },
      });
      if (existing) {
        res.status(409).json({ message: '해당 날짜에 이미 근태 기록이 있어 승인할 수 없습니다.' });
        return;
      }

      const pIn = requestRow.proposedCheckIn;
      const pOut = requestRow.proposedCheckOut;
      if (!pIn && !pOut) {
        res.status(400).json({ message: '신청에 출퇴근 시각이 없습니다.' });
        return;
      }
      if (pIn && pOut && pOut <= pIn) {
        res.status(400).json({ message: '퇴근이 출근보다 이전입니다.' });
        return;
      }

      let status: 'NORMAL' | 'LATE' = 'NORMAL';
      if (pIn) {
        status = await computeCheckInStatus(uid, wd, pIn);
      } else if (!pIn && pOut) {
        status = 'NORMAL';
      }

      await prisma.$transaction(async (tx) => {
        await tx.attendanceRecord.create({
          data: {
            userId: uid,
            date: wd,
            checkIn: pIn,
            checkOut: pOut,
            status,
            workLocation: requestRow.workLocation,
          },
        });
        await tx.attendanceCorrectionRequest.update({
          where: { id },
          data: {
            status: 'APPROVED',
            approvedBy: req.user!.id,
            approvedAt: new Date(),
          },
        });
      });

      if (requestRow.workLocation === 'OVERSEAS') {
        await applyOverseasDeductionIfNeeded(uid, wd);
      }

      res.json({ message: '근태 보정이 반영되었습니다.' });
      return;
    }

    // EDIT_TIMES
    const rec = requestRow.attendanceRecordId
      ? await prisma.attendanceRecord.findUnique({ where: { id: requestRow.attendanceRecordId } })
      : null;
    if (!rec || rec.userId !== uid) {
      res.status(404).json({ message: '대상 근태 기록을 찾을 수 없습니다.' });
      return;
    }

    const newIn = requestRow.proposedCheckIn ?? rec.checkIn;
    const newOut = requestRow.proposedCheckOut ?? rec.checkOut;
    if (newIn && newOut && newOut <= newIn) {
      res.status(400).json({ message: '퇴근이 출근보다 이전입니다.' });
      return;
    }

    let status: 'NORMAL' | 'LATE' = 'NORMAL';
    if (newIn) {
      status = await computeCheckInStatus(uid, rec.date, newIn);
    }

    await prisma.$transaction([
      prisma.attendanceRecord.update({
        where: { id: rec.id },
        data: {
          checkIn: newIn,
          checkOut: newOut,
          status,
        },
      }),
      prisma.attendanceCorrectionRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedBy: req.user!.id,
          approvedAt: new Date(),
        },
      }),
    ]);

    res.json({ message: '근태 시간 수정이 반영되었습니다.' });
  } catch (e: any) {
    console.error('[approveAttendanceCorrectionRequest]', e);
    res.status(500).json({ message: e?.message || '승인 처리 중 오류가 발생했습니다.' });
  }
};

export const rejectAttendanceCorrectionRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const requestRow = await prisma.attendanceCorrectionRequest.findUnique({
    where: { id },
    include: { user: { select: { role: true } } },
  });
  if (!requestRow) {
    res.status(404).json({ message: '신청을 찾을 수 없습니다.' });
    return;
  }
  if (requestRow.status !== 'PENDING') {
    res.status(400).json({ message: '대기 중인 신청만 반려할 수 있습니다.' });
    return;
  }
  if (!assertDesignerFreelancerCorrectionApplicant(req, requestRow.user?.role, res)) {
    return;
  }

  await prisma.attendanceCorrectionRequest.update({
    where: { id },
    data: { status: 'REJECTED' },
  });
  res.json({ message: '신청이 반려되었습니다.' });
};
