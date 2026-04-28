import prisma from '../lib/prisma';
import { calcAnnualLeaveFromHireDate } from '../lib/leaveCalc';

/**
 * 매년 1월 1일 기준 연차 부여 동기화
 * - 일반: 입사일 있는 직원, 1년 미만은 건너뜀
 * - 외국 프리랜서: 연 12일 고정
 * - 기존 balance 있으면 건너뜀 (재부여 방지)
 */
export async function runLeaveBalanceSync(year?: number): Promise<{ created: number; skipped: number }> {
  const targetYear = year ?? new Date().getFullYear();

  const [annualPolicy, freelancerPolicy] = await Promise.all([
    prisma.leavePolicy.findUnique({ where: { name: '연차' } }),
    prisma.leavePolicy.findUnique({ where: { name: '프리랜서연차' } }),
  ]);
  if (!annualPolicy) throw new Error('연차 정책을 찾을 수 없습니다.');

  const users = await prisma.user.findMany({
    where: { isActive: true },
    include: { profile: true },
  });

  let created = 0;
  let skipped = 0;

  for (const u of users) {
    const isFreelancer = u.role === 'FOREIGN_FREELANCER';
    const policy = isFreelancer ? freelancerPolicy : annualPolicy;
    const policyToUse = policy || annualPolicy;

    if (isFreelancer && freelancerPolicy) {
      const existing = await prisma.leaveBalance.findUnique({
        where: { userId_policyId_year: { userId: u.id, policyId: freelancerPolicy.id, year: targetYear } },
      });
      if (existing) {
        skipped++;
      } else {
        await prisma.leaveBalance.create({
          data: {
            userId: u.id,
            policyId: freelancerPolicy.id,
            year: targetYear,
            totalDays: 12,
          },
        });
        created++;
      }
      continue;
    }

    if (isFreelancer) continue; // 프리랜서 정책 없으면 건너뜀

    const hireDate = u.profile?.hireDate;
    if (!hireDate) continue;

    const autoDays = calcAnnualLeaveFromHireDate(hireDate, targetYear);
    if (autoDays == null) continue;

    const existing = await prisma.leaveBalance.findUnique({
      where: { userId_policyId_year: { userId: u.id, policyId: annualPolicy.id, year: targetYear } },
    });

    if (existing) {
      skipped++;
    } else {
      await prisma.leaveBalance.create({
        data: {
          userId: u.id,
          policyId: annualPolicy.id,
          year: targetYear,
          totalDays: autoDays,
        },
      });
      created++;
    }
  }

  return { created, skipped };
}
