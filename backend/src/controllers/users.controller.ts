import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { calcAnnualLeaveFromHireDate } from '../lib/leaveCalc';
import { runLeaveBalanceSync } from '../services/leaveSync.service';
import {
  getPresignedUploadUrlForAvatar,
  getPresignedDownloadUrl,
  deleteS3Object,
} from '../services/s3.service';

const createUserSchema = z.object({
  email: z.string().email('유효한 이메일을 입력해주세요.'),
  password: z.string().min(6, '임시 비밀번호는 최소 6자 이상이어야 합니다.'),
  role: z
    .enum(['EMPLOYEE', 'PLANNING', 'MANAGER', 'SUPER_ADMIN', 'CS', 'DESIGNER', 'FOREIGN_FREELANCER'])
    .default('EMPLOYEE'),
  name: z.string().min(1, '이름을 입력해주세요.'),
  position: z.string().optional(),
  phone: z.string().optional(),
  departmentId: z.string().optional(),
  hireDate: z.string().optional(),
  leaveDays: z.number().min(0).optional(),
  useJapanese: z.boolean().optional(),
});

const setLeaveBalanceSchema = z.object({
  year: z.number().int().optional(),
  /** DB Float — 반차·반반차 등 소수(예: 13.5, 13.25) 허용 */
  totalDays: z.coerce.number().min(0, '연차 일수는 0 이상이어야 합니다.').max(500, '연차 일수가 너무 큽니다.'),
});

const updateUserSchema = z.object({
  name: z.string().optional(),
  position: z.string().optional(),
  phone: z.string().optional(),
  departmentId: z.string().optional(),
  hireDate: z.string().optional().nullable(),
  role: z
    .enum(['EMPLOYEE', 'PLANNING', 'MANAGER', 'SUPER_ADMIN', 'CS', 'DESIGNER', 'FOREIGN_FREELANCER'])
    .optional(),
  useJapanese: z.boolean().optional(),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, '임시 비밀번호는 최소 6자 이상이어야 합니다.'),
});

export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  const result = createUserSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: result.error.errors[0].message });
    return;
  }

  const { email, password, role, name, position, phone, departmentId, hireDate, leaveDays, useJapanese } = result.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ message: '이미 사용 중인 이메일입니다.' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: role as any, // Prisma Role enum에 FOREIGN_FREELANCER 미포함 시 타입 우회
      forcePasswordChange: true,
      profile: {
        create: {
          name,
          position,
          phone,
          departmentId: departmentId || null,
          hireDate: hireDate ? new Date(hireDate) : null,
          preferredLanguage: useJapanese ? 'ja' : 'ko',
        },
      },
    },
    include: { profile: true },
  });

  // 연차 일수 부여: 외국 프리랜서는 12일 고정, 그 외는 입사일 기준
  const year = new Date().getFullYear();
  const isFreelancer = role === 'FOREIGN_FREELANCER';
  const policyName = isFreelancer ? '프리랜서연차' : '연차';
  const policy = await prisma.leavePolicy.findUnique({ where: { name: policyName } });
  if (policy) {
    let daysToGrant: number;
    if (isFreelancer) {
      daysToGrant = 12; // 외국 프리랜서: 연 12일 고정
    } else {
      const hire = (user as any).profile?.hireDate ? new Date((user as any).profile.hireDate) : null;
      if (hire) {
        const autoDays = calcAnnualLeaveFromHireDate(hire, year);
        daysToGrant = autoDays ?? (leaveDays ?? 0);
      } else {
        daysToGrant = leaveDays ?? 0;
      }
    }
    if (daysToGrant > 0) {
      await prisma.leaveBalance.upsert({
        where: {
          userId_policyId_year: { userId: user.id, policyId: policy.id, year },
        },
        update: { totalDays: daysToGrant },
        create: {
          userId: user.id,
          policyId: policy.id,
          year,
          totalDays: daysToGrant,
        },
      });
    }
  }

  res.status(201).json({
    id: user.id,
    email: user.email,
    role: user.role,
    name: (user as any).profile?.name,
  });
};

export const getUsers = async (_req: Request, res: Response): Promise<void> => {
  const users = await prisma.user.findMany({
    include: {
      profile: { include: { department: true } },
      leaveBalances: {
        where: { year: new Date().getFullYear() },
        include: { policy: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  res.json(users.map(u => {
    const annualBalance = u.leaveBalances.find(b => b.policy.name === '연차')
      || u.leaveBalances.find(b => b.policy.name === '프리랜서연차');
    return {
      id: u.id,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      forcePasswordChange: u.forcePasswordChange,
      name: u.profile?.name,
      position: u.profile?.position,
      department: u.profile?.department?.name,
      hireDate: u.profile?.hireDate,
      phone: u.profile?.phone,
      leaveBalance: annualBalance
        ? { totalDays: annualBalance.totalDays, usedDays: annualBalance.usedDays }
        : null,
      preferredLanguage: u.profile?.preferredLanguage ?? 'ko',
    };
  }));
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  const result = updateUserSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: result.error.errors[0].message });
    return;
  }

  const { id } = req.params;
  const { name, position, phone, departmentId, hireDate, role, useJapanese } = result.data;

  if (role !== undefined && req.user!.role !== 'SUPER_ADMIN') {
    res.status(403).json({ message: '권한 변경은 최고 관리자만 가능합니다.' });
    return;
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(role && { role: role as any }),
      profile: {
        update: {
          ...(name && { name }),
          ...(position !== undefined && { position }),
          ...(phone !== undefined && { phone }),
          ...(departmentId !== undefined && { departmentId: departmentId || null }),
          ...(hireDate !== undefined && { hireDate: hireDate ? new Date(hireDate) : null }),
          ...(useJapanese !== undefined && { preferredLanguage: useJapanese ? 'ja' : 'ko' }),
        },
      },
    },
    include: { profile: true },
  });

  // 입사일 변경 시 해당 연도 연차 자동 부여 (기존 balance 없을 때만)
  if (hireDate !== undefined && user.profile?.hireDate) {
    const annualPolicy = await prisma.leavePolicy.findUnique({ where: { name: '연차' } });
    if (annualPolicy) {
      const year = new Date().getFullYear();
      const autoDays = calcAnnualLeaveFromHireDate(user.profile.hireDate, year);
      if (autoDays != null && autoDays > 0) {
        const existing = await prisma.leaveBalance.findUnique({
          where: { userId_policyId_year: { userId: id, policyId: annualPolicy.id, year } },
        });
        if (!existing) {
          await prisma.leaveBalance.create({
            data: {
              userId: id,
              policyId: annualPolicy.id,
              year,
              totalDays: autoDays,
            },
          });
        }
      }
    }
  }

  res.json({ message: '사용자 정보가 수정되었습니다.' });
};

export const resetUserPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  const result = resetPasswordSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: result.error.errors[0].message });
    return;
  }

  const { id } = req.params;
  const { newPassword } = result.data;

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id },
    data: { passwordHash, forcePasswordChange: true },
  });

  res.json({ message: '비밀번호가 초기화되었습니다. 다음 로그인 시 비밀번호 변경이 필요합니다.' });
};

export const setLeaveBalance = async (req: AuthRequest, res: Response): Promise<void> => {
  const result = setLeaveBalanceSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: result.error.errors[0].message });
    return;
  }

  const { id } = req.params;
  const { year: reqYear, totalDays } = result.data;
  const year = reqYear ?? new Date().getFullYear();

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    return;
  }

  const isFreelancer = user.role === 'FOREIGN_FREELANCER';
  const policyName = isFreelancer ? '프리랜서연차' : '연차';
  const policy = await prisma.leavePolicy.findUnique({ where: { name: policyName } });
  if (!policy) {
    res.status(500).json({ message: `${policyName} 정책을 찾을 수 없습니다.` });
    return;
  }

  await prisma.leaveBalance.upsert({
    where: {
      userId_policyId_year: { userId: id, policyId: policy.id, year },
    },
    update: { totalDays },
    create: {
      userId: id,
      policyId: policy.id,
      year,
      totalDays,
    },
  });

  res.json({ message: '연차가 설정되었습니다.' });
};

const syncLeaveBalanceSchema = z.object({
  year: z.number().int().optional(),
});

/** 매년 1월 1일 기준 연차 부여 동기화. 기존 balance 있으면 건너뜀(재부여 방지), 신규만 생성 */
export const syncLeaveBalance = async (req: AuthRequest, res: Response): Promise<void> => {
  const result = syncLeaveBalanceSchema.safeParse(req.body || {});
  const year = result.success && result.data.year != null ? result.data.year : new Date().getFullYear();

  const { created } = await runLeaveBalanceSync(year);

  res.json({
    message: `${year}년 연차 동기화 완료. 신규 부여 ${created}명 (이미 있는 직원은 유지)`,
    created,
  });
};

/** 프로필 아바타 업로드 presigned URL 발급 */
export const getAvatarUploadUrl = async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.object({
    filename: z.string().min(1),
    mimeType: z.string().regex(/^image\//),
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: '이미지 파일 정보가 올바르지 않습니다.' });
    return;
  }
  const result = await getPresignedUploadUrlForAvatar(parsed.data.filename, parsed.data.mimeType, req.user!.id);
  if (!result) {
    res.status(503).json({ message: 'S3 서비스를 사용할 수 없습니다.' });
    return;
  }
  res.json(result);
};

/** 아바타 S3 키 저장 (업로드 완료 후 호출) */
export const updateMyAvatar = async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.object({ s3Key: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 's3Key가 필요합니다.' });
    return;
  }

  const profile = await prisma.employeeProfile.findUnique({ where: { userId: req.user!.id } });
  const oldKey = (profile as any)?.avatarS3Key as string | null | undefined;

  await prisma.employeeProfile.update({
    where: { userId: req.user!.id },
    data: { avatarS3Key: parsed.data.s3Key } as any,
  });

  // 이전 아바타 S3 삭제 (orphan 방지)
  if (oldKey && oldKey !== parsed.data.s3Key) {
    void deleteS3Object(oldKey);
  }

  res.json({ message: '프로필 사진이 업데이트되었습니다.' });
};

/** 아바타 presigned URL 반환 (채팅 이미지와 동일한 방식) */
export const getAvatarUrl = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: { profile: true },
  });
  const s3Key = (user?.profile as any)?.avatarS3Key as string | null | undefined;
  if (!s3Key) {
    res.status(404).json({ message: '프로필 사진이 없습니다.' });
    return;
  }
  const url = await getPresignedDownloadUrl(s3Key, undefined, { disposition: 'inline' });
  if (!url) {
    res.status(503).json({ message: 'S3 URL 생성 실패' });
    return;
  }
  res.json({ url });
};

/** 계정 완전 삭제 (DB에서 제거, 되돌릴 수 없음) */
export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  if (id === req.user!.id) {
    res.status(400).json({ message: '자기 자신을 삭제할 수 없습니다.' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    return;
  }

  // approver로 연결된 LeaveRequest의 approvedBy를 먼저 null로
  await prisma.leaveRequest.updateMany({
    where: { approvedBy: id },
    data: { approvedBy: null },
  });

  await prisma.user.delete({ where: { id } });

  res.json({ message: '계정이 삭제되었습니다.' });
};
