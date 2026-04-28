const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const TRANSLATION_ROOT = path.join(__dirname, '..', '..');
const DICT_DIR = path.join(TRANSLATION_ROOT, 'translation', 'dictionary');
const GUIDELINE_DIR = path.join(TRANSLATION_ROOT, 'translation', 'guideline');
const DICT_FILES = ['colors.json', 'apparel_terms.json', 'phrases.json'];

async function seedTranslationFromFiles() {
  const dictCount = await prisma.translationDictionaryEntry.count();
  if (dictCount === 0) {
    let sortBase = 0;
    for (const file of DICT_FILES) {
      const fp = path.join(DICT_DIR, file);
      if (!fs.existsSync(fp)) continue;
      const content = JSON.parse(fs.readFileSync(fp, 'utf-8'));
      const list = content.entries || [];
      const category = file.replace('.json', '');
      let j = 0;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e || !e.src || !e.tgt) continue;
        await prisma.translationDictionaryEntry.create({
          data: {
            category,
            ko: e.src,
            en: e.tgt,
            ja: '',
            sortOrder: sortBase + j,
          },
        });
        j += 1;
      }
      sortBase += j;
    }
    console.log('✅ 번역 고정 딕셔너리(ko·en·ja 한 행) 파일에서 임포트 완료');
  } else {
    console.log('ℹ️  번역 딕셔너리가 이미 있어 파일 임포트를 건너뜁니다.');
  }

  if (fs.existsSync(GUIDELINE_DIR)) {
    const guideFiles = fs.readdirSync(GUIDELINE_DIR).filter((f) => f.endsWith('.md'));
    for (const file of guideFiles) {
      const name = file.replace('.md', '');
      const gContent = fs.readFileSync(path.join(GUIDELINE_DIR, file), 'utf-8');
      await prisma.translationGuideline.upsert({
        where: { name },
        create: { name, content: gContent },
        update: { content: gContent },
      });
    }
    if (guideFiles.length) {
      console.log(`✅ 번역 가이드라인 ${guideFiles.length}개 MD 동기화 완료`);
    }
  }
}

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
  // 외국 프리랜서 연차 정책 (년 12일 고정)
  await prisma.leavePolicy.upsert({
    where: { name: '프리랜서연차' },
    update: {},
    create: {
      name: '프리랜서연차',
      daysPerYear: 12,
      isCarryOver: false,
      description: '외국 프리랜서 연차 (년 12일 고정)',
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

  // 채팅 채널: 축구, 농구, 야구
  await prisma.chatChannel.upsert({ where: { slug: 'soccer' }, update: {}, create: { slug: 'soccer', name: '축구', order: 0 } });
  await prisma.chatChannel.upsert({ where: { slug: 'basketball' }, update: {}, create: { slug: 'basketball', name: '농구', order: 1 } });
  await prisma.chatChannel.upsert({ where: { slug: 'baseball' }, update: {}, create: { slug: 'baseball', name: '야구', order: 2 } });
  console.log('✅ 채팅 채널 준비 완료 (축구, 농구, 야구)');

  await seedTranslationFromFiles();

  console.log('✅ 초기 계정 생성 완료');
  console.log(`   이메일: ${user.email}`);
  console.log(`   비밀번호: admin1234!`);
  console.log(`   권한: 대표 (SUPER_ADMIN)`);
  console.log(`   최초 로그인 시 비밀번호 변경 필요`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
