/**
 * 한국(Asia/Seoul) 기준 오늘 날짜 반환
 * 서버가 UTC 환경에서 실행될 때 날짜가 하루 뒤로 밀리는 문제 방지
 */
export function getTodayInSeoul(): Date {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const str = formatter.format(new Date()); // "2025-03-17"
  return new Date(str + 'T00:00:00.000Z'); // UTC 자정으로 해석 → DB DATE 저장 시 정확함
}

/** 해당 날짜의 10:00 KST (지각 기준): 10:00 이후 출근 = 지각 */
export function getLateDeadlineInSeoul(date: Date): Date {
  return new Date(date.getTime() + 60 * 60 * 1000); // 00:00 UTC = 09:00 KST → +1h = 10:00 KST
}

/** 한국(Asia/Seoul) 기준 현재 연도 */
export function getYearInSeoul(): number {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
  });
  return parseInt(formatter.format(new Date()), 10);
}

/** 서울 기준 연/월 — 최종 시안 S3 하위 경로 `YYYY/MM` (예: `2026/04`) */
export function getYearMonthPathInSeoul(d = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
  });
  const parts = formatter.formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  return `${y}/${m}`;
}
