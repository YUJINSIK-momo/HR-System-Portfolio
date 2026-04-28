import sharp from 'sharp';

/** 축구·농구·배구: 3247→오른쪽 960px 제거, 2865→850px 제거 (선형 보간) */
const CALIB_SOCCER_BASKETBALL_VOLLEYBALL = { w1: 3247, cut1: 960, w2: 2865, cut2: 850 };
/** 야구(HOF) 전용: 3247→오른쪽 900px 제거, 2865→820px 제거 (선형 보간). 일반 야구는 축구·농구와 동일. */
const CALIB_BASEBALL_HOF = { w1: 3247, cut1: 900, w2: 2865, cut2: 820 };

function calibrationForSport(sport: string): typeof CALIB_SOCCER_BASKETBALL_VOLLEYBALL {
  if (sport === 'BASEBALL_HOF') return CALIB_BASEBALL_HOF;
  return CALIB_SOCCER_BASKETBALL_VOLLEYBALL;
}

/**
 * 오른쪽에서 잘라낼 가로 픽셀 수(선형 보간). 종목별 기준 폭은 `calibrationForSport` 참고.
 */
export function customerSubtractWidthPx(originalWidth: number, sport: string): number {
  const { w1, cut1, w2, cut2 } = calibrationForSport(sport);
  const a = (cut1 - cut2) / (w1 - w2);
  const b = cut1 - a * w1;
  return Math.max(0, Math.round(a * originalWidth + b));
}

function isRasterMime(mime: string): boolean {
  const m = mime.toLowerCase();
  if (m === 'image/svg+xml') return false;
  return m.startsWith('image/');
}

/**
 * 오른쪽을 잘라 **왼쪽** keepW(px)만 남김. 원본과 동일하면 원본 버퍼 반환.
 * `outputExtension`: 저장 파일 확장자(점 포함), 파일명은 팀명_상품명_버전과 동일 규칙(접미사 없음).
 * `sport`: 고객용 크롭 기준(야구(HOF)만 별도 보정, 그 외는 축구·농구·배구와 동일).
 */
export async function cropCustomerKeepLeft(
  buffer: Buffer,
  mimeType: string,
  sport: string
): Promise<{ buffer: Buffer; contentType: string; outputExtension: string | null }> {
  if (!isRasterMime(mimeType)) {
    throw new Error('RASTER_IMAGE_ONLY');
  }

  const meta = await sharp(buffer).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) {
    throw new Error('INVALID_IMAGE');
  }

  let sub = customerSubtractWidthPx(w, sport);
  sub = Math.min(sub, w - 1);
  sub = Math.max(0, sub);
  let keepW = w - sub;
  keepW = Math.max(1, Math.min(keepW, w));

  if (keepW >= w) {
    return {
      buffer,
      contentType: mimeType.split(';')[0].trim() || 'application/octet-stream',
      outputExtension: null,
    };
  }

  const fmt = meta.format;

  const baseExtract = sharp(buffer).extract({ left: 0, top: 0, width: keepW, height: h });

  if (fmt === 'jpeg' || fmt === 'jpg') {
    const out = await baseExtract.jpeg({ quality: 92 }).toBuffer();
    return { buffer: out, contentType: 'image/jpeg', outputExtension: '.jpg' };
  }
  if (fmt === 'png') {
    const out = await baseExtract.png().toBuffer();
    return { buffer: out, contentType: 'image/png', outputExtension: '.png' };
  }
  if (fmt === 'webp') {
    const out = await baseExtract.webp({ quality: 90 }).toBuffer();
    return { buffer: out, contentType: 'image/webp', outputExtension: '.webp' };
  }
  if (fmt === 'gif') {
    const out = await baseExtract.png().toBuffer();
    return { buffer: out, contentType: 'image/png', outputExtension: '.png' };
  }

  const out = await baseExtract.png().toBuffer();
  return { buffer: out, contentType: 'image/png', outputExtension: '.png' };
}
