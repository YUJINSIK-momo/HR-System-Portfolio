/** 경조휴가 세부 유형 (백엔드 FamilyLeaveSubType과 동일) */
export const FAMILY_LEAVE_SUBTYPES = [
  'OWN_MARRIAGE',
  'CHILD_MARRIAGE',
  'SPOUSE_CHILDBIRTH',
  'PARENT_DEATH',
  'GRANDPARENT_DEATH',
  'SIBLING_DEATH',
] as const;

export type FamilyLeaveSubType = (typeof FAMILY_LEAVE_SUBTYPES)[number];

export const FAMILY_LEAVE_BUSINESS_DAYS: Record<FamilyLeaveSubType, number> = {
  OWN_MARRIAGE: 5,
  CHILD_MARRIAGE: 1,
  SPOUSE_CHILDBIRTH: 10,
  PARENT_DEATH: 5,
  GRANDPARENT_DEATH: 2,
  SIBLING_DEATH: 2,
};

function toLocalKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isBusinessDayLocal(d: Date, holidayDateKeys: Set<string>): boolean {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  if (holidayDateKeys.has(toLocalKey(d))) return false;
  return true;
}

/** 시작일(포함)부터 n번째 영업일까지의 종료일(포함). 주말·공휴일 제외. */
export function computeFamilyLeaveEndLocal(
  start: Date,
  businessDaysInclusive: number,
  holidayDateKeys: Set<string>
): Date {
  let remaining = businessDaysInclusive;
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  let last = new Date(d);
  let guard = 0;
  while (remaining > 0 && guard < 800) {
    guard += 1;
    if (isBusinessDayLocal(d, holidayDateKeys)) {
      remaining -= 1;
      last = new Date(d);
    }
    if (remaining > 0) {
      d.setDate(d.getDate() + 1);
    }
  }
  return last;
}
