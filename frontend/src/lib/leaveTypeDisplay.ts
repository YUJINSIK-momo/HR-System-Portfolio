import type { TranslationKey } from '@/lib/translations';

type LeaveRow = { type: string; familySubType?: string | null };

/** 휴가 유형 표시 (경조는 세부 유형 포함) */
export function leaveTypeDisplay(
  r: LeaveRow,
  t: (key: TranslationKey) => string,
  typeLabel: Record<string, string>
): string {
  if (r.type === 'FAMILY' && r.familySubType) {
    const subKey = `familySub_${r.familySubType}` as TranslationKey;
    return `${t('family')} · ${t(subKey)}`;
  }
  return typeLabel[r.type] || r.type;
}
