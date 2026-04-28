/**
 * 직책이 파트타임이면 10:00 기준 지각 판정을 적용하지 않음 (시간과 무관하게 정상 출근).
 * 공백은 무시하고 비교 (예: "파트 타임" → 파트타임으로 인식).
 */
export function isPartTimePosition(position: string | null | undefined): boolean {
  const normalized = position?.replace(/\s/g, '') ?? '';
  return normalized === '파트타임';
}
