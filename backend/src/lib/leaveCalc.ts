/**
 * 입사일 기준 경과 연수 (해당 연도 12월 31일 시점, 법정 연차 기준)
 * - 해당 연도 중 1주년을 맞이하면 15일 부여 (근로기준법)
 * - 예: 2025-02 입사, 2026년 → 1주년(2026-02)이 해당 연도 중 도래 → years=1, 15일
 * - 예: 2024-02 입사, 2026년 → 2주년(2026-02)이 해당 연도 중 도래 → years=2, 16일
 */
export function getYearsOfService(hireDate: Date, year: number): number {
  const dec31 = new Date(year, 11, 31); // 해당 연도 12/31 자정
  const hire = new Date(hireDate);
  hire.setHours(0, 0, 0, 0);
  dec31.setHours(0, 0, 0, 0);

  let years = 0;
  let anniversary = new Date(hire);
  anniversary.setFullYear(anniversary.getFullYear() + 1);
  anniversary.setHours(0, 0, 0, 0);
  while (anniversary <= dec31) {
    years++;
    anniversary.setFullYear(anniversary.getFullYear() + 1);
  }
  return years;
}

/**
 * 해당 연도 1월 1일 기준 연차 일수 (입사일 기반, 한국 근로기준법)
 * - 1년 미만: null (수동 설정)
 * - 1년 경과: 15일
 * - 2년 경과: 16일
 * - 2년 단위로 +1일 추가: 4년→17일, 6년→18일, 8년→19일 … 최대 25일
 */
export function calcAnnualLeaveFromHireDate(hireDate: Date, year: number): number | null {
  const years = getYearsOfService(hireDate, year);
  if (years < 1) return null;
  if (years === 1) return 15;
  return Math.min(16 + Math.floor((years - 2) / 2), 25);
}
