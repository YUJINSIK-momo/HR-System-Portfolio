/** 상세·목록 카드와 동일: 1st, 2nd, … */
export function designVersionOrdinal(n: number): string {
  if (n >= 11 && n <= 13) return `${n}th`;
  const last = n % 10;
  if (last === 1) return `${n}st`;
  if (last === 2) return `${n}nd`;
  if (last === 3) return `${n}rd`;
  return `${n}th`;
}

function sanitizeSegment(s: string): string {
  return (s || '').replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, ' ').trim() || 'file';
}

/**
 * 다운로드 파일명 베이스 (확장자 없음).
 * 프론트 `buildDesignRequestCompositeTitle`와 동일 규칙:
 * - 팀명이 `…追加変更`로 끝나면(중복 접미) `팀명`만 (공식전이면 끝에 `【●】`)
 * - 상품이 `ユニフォーム`이면 `팀명_1st` 형태로 상품 구간 생략
 * - 농구·공식전이면 `_버전` 뒤에 `【●】`
 */
export function buildDesignRequestDownloadBaseName(dr: {
  teamName: string;
  product: string;
  version: number;
  sport?: string;
  basketballOfficialGame?: boolean;
}): string {
  const official = dr.sport === 'BASKETBALL' && dr.basketballOfficialGame === true;
  const marker = official ? '【●】' : '';
  const tnRaw = (dr.teamName || '').trim();
  if (tnRaw.endsWith('追加変更')) {
    const team = sanitizeSegment(tnRaw);
    return official ? `${team}${marker}` : team;
  }
  const team = sanitizeSegment(dr.teamName);
  const ord = designVersionOrdinal(dr.version);
  const pRaw = (dr.product || '').trim();
  if (pRaw === 'ユニフォーム') {
    return `${team}_${ord}${marker}`;
  }
  const p = sanitizeSegment(dr.product);
  return `${team}_${p}_${ord}${marker}`;
}

/** 원본 파일명에서 확장자만 붙임 */
export function withOriginalExtension(baseName: string, originalFilename: string): string {
  const m = /\.([^.]+)$/.exec(originalFilename || '');
  const ext = m ? m[1] : 'bin';
  return `${baseName}.${ext}`;
}
