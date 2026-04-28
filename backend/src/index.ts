import path from 'path';
import dotenv from 'dotenv';

// backend/.env 명시적 로드 (cwd와 무관하게)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import cron from 'node-cron';
import app from './app';
import prisma from './lib/prisma';
import { bootstrapChatChannels } from './services/chatChannelsBootstrap.service';
import { runLeaveBalanceSync } from './services/leaveSync.service';
import { runDataRetention, shouldRunRetention } from './services/dataRetention.service';
import { runChatRetention, runDesignDraftChatRetention } from './services/chatRetention.service';
import { runDesignRequestRetention } from './services/designRequestRetention.service';
import { refreshTranslationCache } from './services/translationData.service';

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);

  refreshTranslationCache().catch((err) => console.error('[Translation] initial cache:', err));

  bootstrapChatChannels().catch((err) => console.error('[Chat] bootstrap channels:', err));

  // 매년 1월 1일 00:00에 사내 캘린더 메모·일정 전체 삭제
  cron.schedule('0 0 1 1 *', () => {
    const year = new Date().getFullYear();
    Promise.all([
      prisma.calendarMemo.deleteMany({}),
      prisma.calendarEvent.deleteMany({}),
    ])
      .then(([memos, events]) => {
        if (memos.count > 0 || events.count > 0) {
          console.log(`[캘린더 초기화] ${year}년 1월 1일: 메모 ${memos.count}건, 일정 ${events.count}건 삭제`);
        }
      })
      .catch((err) => console.error('[캘린더 초기화] 오류:', err));
  });

  // 매년 1월 1일 00:05에 연차 부여 동기화 자동 실행
  cron.schedule('5 0 1 1 *', () => {
    const year = new Date().getFullYear();
    runLeaveBalanceSync(year).then(({ created }) => {
      if (created > 0) console.log(`[연차 동기화] ${year}년 연차 신규 부여 ${created}명`);
    }).catch((err) => console.error('[연차 동기화] 오류:', err));
  });

  // 매일 새벽 3시에 채팅·디자인 요청 1년 초과분 삭제 (S3 첨부 포함)
  cron.schedule('0 3 * * *', () => {
    runChatRetention()
      .then((r) => {
        if (r.deletedMessages > 0) {
          console.log(`[채팅 보존] 1년 초과 메시지 ${r.deletedMessages}건 삭제`);
        }
        return runDesignRequestRetention();
      })
      .then((r) => {
        if (r.deleted > 0) {
          console.log(`[디자인 요청 보존] 1년 초과 요청 ${r.deleted}건 삭제`);
        }
      })
      .catch((err) => console.error('[채팅·디자인 보존] 오류:', err));
  });

  // 매일 새벽 3시 10분: 디자인 요청 알림·시안 알림 채널 7일 초과 메시지 삭제
  cron.schedule('10 3 * * *', () => {
    runDesignDraftChatRetention()
      .then((r) => {
        if (r.deletedMessages > 0) {
          console.log(`[알림채널 보존] design-notify/draft-notify 7일 초과 메시지 ${r.deletedMessages}건 삭제`);
        }
      })
      .catch((err) => console.error('[알림채널 보존] 오류:', err));
  });

  // 3년마다(2029, 2032, 2035...) 1월 1일 00:10에 3년 이전 데이터 삭제
  cron.schedule('10 0 1 1 *', () => {
    const year = new Date().getFullYear();
    if (!shouldRunRetention(year)) return;
    runDataRetention(year).then((r) => {
      const total =
        r.deletedAttendance +
        r.deletedLeaveRequests +
        r.deletedLeaveBalances +
        r.deletedAttendanceCorrections;
      if (total > 0) {
        console.log(
          `[데이터 삭제] ${year}년 1월 1일 실행: 근태 ${r.deletedAttendance}건, 연차신청 ${r.deletedLeaveRequests}건, 연차잔액 ${r.deletedLeaveBalances}건, 근태보정신청 ${r.deletedAttendanceCorrections}건 삭제`
        );
      }
    }).catch((err) => console.error('[데이터 삭제] 오류:', err));
  });
});
