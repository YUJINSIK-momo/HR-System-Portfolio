/** 디자인 요청 상품명 — 일본어 고정 (종목별) */
export const DESIGN_PRODUCTS_BY_SPORT = {
  SOCCER: [
    'ユニフォーム',
    'GK',
    'オリジナルソックス',
    'アームスリーブ',
    '昇華パーカー',
    '昇華ウィンドブレーカー',
  ],
  BASKETBALL: [
    'ユニフォーム',
    'Reversible',
    '昇華パーカー',
    '昇華ウィンドブレーカー',
    'オリジナルソックス',
    'アームスリーブ',
  ],
  BASEBALL: [
    '昇華Tシャツ',
    '昇華ハーフパンツ',
    'ユニフォーム',
    '昇華パーカー',
    '昇華ウィンドブレーカー',
    'オリジナルソックス',
    'アームスリーブ',
  ],
  BASEBALL_HOF: ['ユニフォーム', 'パンツ', 'キャップ', 'グラウンドコート', '刺繡フリース', 'ヘルメットワッペン'],
  VOLLEYBALL: [
    'ユニフォーム',
    'パンツ',
    'Receive',
    'オリジナルソックス',
    'アームスリーブ',
    '昇華パーカー',
    '昇華ウィンドブレーカー',
  ],
} as const;

export type DesignSportForProduct = keyof typeof DESIGN_PRODUCTS_BY_SPORT;

/** 신규 선택지에서 제외했으나 기존 레코드 호환용 */
const LEGACY_PRODUCTS_BY_SPORT: Partial<Record<DesignSportForProduct, readonly string[]>> = {
  SOCCER: ['パンツ'],
  BASKETBALL: ['パンツ'],
};

export function isValidProductForSport(sport: string, product: string): boolean {
  const list = DESIGN_PRODUCTS_BY_SPORT[sport as DesignSportForProduct];
  if (Array.isArray(list) && (list as readonly string[]).includes(product)) return true;
  const legacy = LEGACY_PRODUCTS_BY_SPORT[sport as DesignSportForProduct];
  return Array.isArray(legacy) && legacy.includes(product);
}

export function defaultProductForSport(sport: string): string {
  const list = DESIGN_PRODUCTS_BY_SPORT[sport as DesignSportForProduct];
  return list?.[0] ?? 'ユニフォーム';
}
