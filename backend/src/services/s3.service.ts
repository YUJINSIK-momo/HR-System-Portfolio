import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let s3Client: S3Client | null = null;

function getS3Client(): S3Client | null {
  if (s3Client) return s3Client;
  const key = process.env.AWS_ACCESS_KEY_ID;
  const secret = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION;
  if (!key || !secret || !region) {
    console.warn(
      '[S3] AWS 자격·리전이 없습니다. AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION 을 설정하세요.'
    );
    return null;
  }
  s3Client = new S3Client({ region });
  return s3Client;
}

/** 이미지 전용 버킷 (예: linechatbot-img). 야구 최종 시안 키는 여기서 조회·업로드 */
function getS3ImageBucket(): string | undefined {
  return process.env.S3_IMG_BUCKET?.trim() || undefined;
}

function getS3ChatBucket(): string | undefined {
  return process.env.S3_CHAT_BUCKET?.trim() || undefined;
}

export async function getPresignedUploadUrl(
  filename: string,
  mimeType: string,
  userId: string
): Promise<{ uploadUrl: string; s3Key: string } | null> {
  const client = getS3Client();
  const bucket = getS3ChatBucket();
  if (!client || !bucket) return null;

  const ext = filename.split('.').pop() || '';
  const s3Key = `chat/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    ContentType: mimeType,
  });

  try {
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
    return { uploadUrl, s3Key };
  } catch (err) {
    console.error('[S3] Presigned URL error:', err);
    return null;
  }
}

/** 프로필 아바타 — chat 버킷 `avatars/{userId}/...` */
export async function getPresignedUploadUrlForAvatar(
  filename: string,
  mimeType: string,
  userId: string
): Promise<{ uploadUrl: string; s3Key: string } | null> {
  if (!mimeType.startsWith('image/')) return null;
  const client = getS3Client();
  const bucket = getS3ChatBucket();
  if (!client || !bucket) return null;

  const ext = filename.split('.').pop() || 'png';
  const s3Key = `avatars/${userId}/${Date.now()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    ContentType: mimeType,
  });

  try {
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });
    return { uploadUrl, s3Key };
  } catch (err) {
    console.error('[S3] Avatar presigned URL error:', err);
    return null;
  }
}

/** 버킷 내 design/{축구|농구|야구}/ 경로 — 디자인 요청 첨부 업로드 등 (최종 시안 갤러리와 별개) */
export const DESIGN_SPORT_FOLDER: Record<
  'SOCCER' | 'BASKETBALL' | 'BASEBALL' | 'BASEBALL_HOF' | 'VOLLEYBALL',
  string
> = {
  SOCCER: '축구',
  BASKETBALL: '농구',
  BASEBALL: '야구',
  BASEBALL_HOF: '야구-HOF',
  VOLLEYBALL: '배구',
};

/**
 * `S3_IMG_BUCKET`(예: linechatbot-img) 안 `{종목}-order-img/` 등 레거시·이미지 키 prefix.
 */
export const FINAL_DRAFT_ORDER_IMG_PREFIX: Record<
  'SOCCER' | 'BASKETBALL' | 'BASEBALL' | 'VOLLEYBALL',
  string
> = {
  SOCCER: 'soccer-order-img/',
  BASKETBALL: 'basketball-order-img/',
  BASEBALL: 'baseball-order-img/',
  VOLLEYBALL: 'volleyball-order-img/',
};

const ALL_ORDER_IMG_PREFIXES: string[] = [
  ...new Set(Object.values(FINAL_DRAFT_ORDER_IMG_PREFIX)),
];

/** 예전에 버킷 안에 또 linechatbot-img/ 를 붙이던 키 — 검증·호환 */
const FINAL_DRAFT_BASEBALL_NESTED_LEGACY_PREFIX = 'linechatbot-img/baseball-order-img/';

/** order-img 경로(이미지 버킷) — 기존 첨부·레거시 키 조회 시 버킷 선택에 사용 */
export function isOrderImgBucketGalleryKey(s3Key: string): boolean {
  if (s3Key.startsWith(FINAL_DRAFT_BASEBALL_NESTED_LEGACY_PREFIX)) return true;
  return ALL_ORDER_IMG_PREFIXES.some((p) => s3Key.startsWith(p));
}

/**
 * 객체 키에 맞는 버킷.
 * order-img·중첩 레거시 → `S3_IMG_BUCKET` 우선, 없으면 `S3_CHAT_BUCKET`; 그 외(일반 design/chat 등) → `S3_CHAT_BUCKET`.
 */
export function resolveBucketForKey(s3Key: string): string | null {
  if (isOrderImgBucketGalleryKey(s3Key)) {
    return getS3ImageBucket() || getS3ChatBucket() || null;
  }
  return getS3ChatBucket() || null;
}

/** 공지 이미지 — chat 버킷 `announcements/{userId}/...` */
export async function getPresignedUploadUrlForAnnouncement(
  filename: string,
  mimeType: string,
  userId: string
): Promise<{ uploadUrl: string; s3Key: string } | null> {
  if (!mimeType.startsWith('image/')) {
    return null;
  }
  const client = getS3Client();
  const bucket = getS3ChatBucket();
  if (!client || !bucket) return null;

  const ext = filename.split('.').pop() || 'png';
  const s3Key = `announcements/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    ContentType: mimeType,
  });

  try {
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
    return { uploadUrl, s3Key };
  } catch (err) {
    console.error('[S3] Announcement image presigned URL error:', err);
    return null;
  }
}

export async function getPresignedUploadUrlForDesign(
  filename: string,
  mimeType: string,
  userId: string,
  sport: 'SOCCER' | 'BASKETBALL' | 'BASEBALL' | 'BASEBALL_HOF' | 'VOLLEYBALL'
): Promise<{ uploadUrl: string; s3Key: string } | null> {
  const client = getS3Client();
  const bucket = getS3ChatBucket();
  if (!client || !bucket) return null;

  const ext = filename.split('.').pop() || '';
  const folder = DESIGN_SPORT_FOLDER[sport];
  const s3Key = `design/${folder}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    ContentType: mimeType,
  });

  try {
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
    return { uploadUrl, s3Key };
  } catch (err) {
    console.error('[S3] Design presigned URL error:', err);
    return null;
  }
}

/** S3 키 존재 여부 확인 (HeadObject). 없으면 false, 있으면 true */
export async function checkS3KeyExists(s3Key: string): Promise<boolean> {
  if (s3Key.startsWith('https://') || s3Key.startsWith('http://')) return true;
  const client = getS3Client();
  const bucket = resolveBucketForKey(s3Key);
  if (!client || !bucket) return false;
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: s3Key }));
    return true;
  } catch (err: unknown) {
    const code = (err as { name?: string; $metadata?: { httpStatusCode?: number } })?.name;
    const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    if (code === 'NotFound' || code === 'NoSuchKey' || status === 404) return false;
    console.error('[S3] HeadObject error:', s3Key, err);
    return false;
  }
}

/**
 * S3 presigned GetObject는 ResponseContentDisposition 전체가 ASCII여야 하며,
 * filename="…" 에 비ASCII(일본어·특수문자 등)가 들어가면 ISO-8859-1 불가 오류가 난다.
 * RFC 6266: ASCII fallback + filename*=UTF-8''percent-encoded
 */
/**
 * @param kind `inline` — 브라우저가 새 탭에서 표시(이미지·PDF 미리보기 등). `attachment` — 다운로드 저장 유도.
 */
export function buildAttachmentContentDisposition(
  originalFilename: string,
  kind: 'attachment' | 'inline' = 'attachment'
): string {
  const name = (originalFilename || '').trim() || 'download';
  const asciiFallback = name
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/"/g, '_')
    .replace(/\\/g, '_')
    .slice(0, 180);
  const safe = asciiFallback.length > 0 ? asciiFallback : 'download';
  const encoded = encodeURIComponent(name);
  return `${kind}; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

export async function getPresignedDownloadUrl(
  s3Key: string,
  filename?: string,
  opts?: { disposition?: 'attachment' | 'inline' }
): Promise<string | null> {
  // WP BK import 이미지: 전체 URL을 s3Key에 저장한 경우 그대로 반환
  if (s3Key.startsWith('https://') || s3Key.startsWith('http://')) {
    return s3Key;
  }
  const client = getS3Client();
  const bucket = resolveBucketForKey(s3Key);
  if (!client || !bucket) return null;
  try {
    const params: { Bucket: string; Key: string; ResponseContentDisposition?: string } = {
      Bucket: bucket,
      Key: s3Key,
    };
    if (filename) {
      params.ResponseContentDisposition = buildAttachmentContentDisposition(
        filename,
        opts?.disposition ?? 'attachment'
      );
    }
    const command = new GetObjectCommand(params);
    return await getSignedUrl(client, command, { expiresIn: 3600 });
  } catch (err) {
    console.error('[S3] Download URL error:', err);
    return null;
  }
}

/** S3 객체 삭제 (에러 시 로깅만, 실패해도 false 반환) */
/** S3 객체 전체를 Buffer로 (이미지 서버 처리용) */
export async function getObjectBuffer(s3Key: string): Promise<Buffer | null> {
  const client = getS3Client();
  const bucket = resolveBucketForKey(s3Key);
  if (!client || !bucket) return null;
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: s3Key }));
    if (!res.Body) return null;
    const bytes = await res.Body.transformToByteArray();
    return Buffer.from(bytes);
  } catch (err) {
    console.error('[S3] GetObject buffer error:', s3Key, err);
    return null;
  }
}

/** 동일 버킷 내 객체 복사 (파일명 변경 시 키 갱신용). CopySource 키는 세그먼트별 URL 인코딩 */
export async function copyS3Object(sourceKey: string, destKey: string): Promise<boolean> {
  const client = getS3Client();
  const srcBucket = resolveBucketForKey(sourceKey);
  const destBucket = resolveBucketForKey(destKey);
  if (!client || !srcBucket || !destBucket) return false;
  if (sourceKey === destKey) return true;
  if (srcBucket !== destBucket) {
    console.error('[S3] CopyObject: source/dest must be in the same bucket', sourceKey, destKey);
    return false;
  }
  try {
    const copySource = `${srcBucket}/${sourceKey.split('/').map(encodeURIComponent).join('/')}`;
    await client.send(
      new CopyObjectCommand({
        Bucket: destBucket,
        Key: destKey,
        CopySource: copySource,
      })
    );
    return true;
  } catch (err) {
    console.error('[S3] CopyObject error:', sourceKey, '->', destKey, err);
    return false;
  }
}

export async function deleteS3Object(s3Key: string): Promise<boolean> {
  const client = getS3Client();
  const bucket = resolveBucketForKey(s3Key);
  if (!client || !bucket) return false;
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: s3Key }));
    return true;
  } catch (err) {
    console.error('[S3] Delete error:', s3Key, err);
    return false;
  }
}
