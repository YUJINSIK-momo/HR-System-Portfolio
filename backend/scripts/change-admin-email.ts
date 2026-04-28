import dotenv from 'dotenv';
dotenv.config();
import prisma from '../src/lib/prisma';

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: 'admin@company.com' },
  });
  if (!existing) {
    console.log('⚠️ admin@company.com 계정을 찾을 수 없습니다.');
    return;
  }

  await prisma.user.update({
    where: { email: 'admin@company.com' },
    data: { email: 'admin@jinsik.com' },
  });

  console.log('✅ 이메일이 admin@company.com → admin@jinsik.com 로 변경되었습니다.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
