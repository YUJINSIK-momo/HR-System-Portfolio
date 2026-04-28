import dotenv from 'dotenv';
dotenv.config();
import bcrypt from 'bcryptjs';
import prisma from '../src/lib/prisma';

async function main() {
  const passwordHash = await bcrypt.hash('mote1750!!', 12);
  const user = await prisma.user.update({
    where: { email: 'admin@jinsik.com' },
    data: { passwordHash },
  });
  console.log('✅ admin@jinsik.com 비밀번호가 mote1750!! 로 변경되었습니다.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
