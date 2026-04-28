import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 연차 정책 생성
  const annualPolicy = await prisma.leavePolicy.upsert({
    where: { name: '연차' },
    update: {},
    create: {
      name: '연차',
      daysPerYear: 15,
      isCarryOver: false,
      description: '법정 연차',
    },
  });
  console.log('✅ 연차 정책 준비 완료');

  // 공휴일은 seed에 포함하지 않음 → 관리자 화면 "공휴일 동기화" 버튼으로 API에서 불러옴

  const passwordHash = await bcrypt.hash('admin1234!', 12);

  const user = await prisma.user.upsert({
    where: { email: 'admin@jinsik.com' },
    update: {},
    create: {
      email: 'admin@jinsik.com',
      passwordHash,
      role: 'SUPER_ADMIN',
      forcePasswordChange: true,
      profile: {
        create: {
          name: '관리자',
          position: '대표',
        },
      },
    },
  });

  // 관리자에게 연차 부여 (옵션)
  const year = new Date().getFullYear();
  await prisma.leaveBalance.upsert({
    where: {
      userId_policyId_year: { userId: user.id, policyId: annualPolicy.id, year },
    },
    update: {},
    create: {
      userId: user.id,
      policyId: annualPolicy.id,
      year,
      totalDays: 15,
    },
  });

  console.log('✅ 초기 계정 생성 완료');
  console.log(`   이메일: ${user.email}`);
  console.log(`   비밀번호: admin1234!`);
  console.log(`   권한: 대표 (SUPER_ADMIN)`);
  console.log(`   최초 로그인 시 비밀번호 변경 필요`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
