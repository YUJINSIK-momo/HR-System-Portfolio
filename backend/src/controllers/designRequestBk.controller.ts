/**
 * 디자인 요청 BK (백데이터 Import) 컨트롤러
 * - req[0]  → DesignRequest (초기 요청) + DesignRequestAttachment
 * - req[1+] → DesignRequestReply(RE_REQUEST) + DesignRequestReplyAttachment
 * - WP 작성자(dc:creator) → userMapping 으로 등록자 매핑
 * - 담당 디자이너 assigneeId 지정 가능
 */

import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import https from 'https';
import http from 'http';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import {
  DESIGN_PRODUCTS_BY_SPORT,
  defaultProductForSport,
  type DesignSportForProduct,
} from '../constants/designProducts';

const VALID_SPORTS = ['SOCCER', 'BASKETBALL', 'BASEBALL', 'BASEBALL_HOF', 'VOLLEYBALL'] as const;
type ValidSport = (typeof VALID_SPORTS)[number];

const WP_DATA_DIR = path.resolve(__dirname, '../../data/wp');

// ---------------------------------------------------------------------------
// 팀명 파싱: WP 포스트 제목에서 teamName / product / version 추출
// 지원 형식:
//   NAKAIZUO_ユニフォーム_1st
//   NAKAIZUO_ユニフォーム_2nd【●】
//   NAKAIZUO_2nd【●】_ユニフォーム   ← 버전이 상품명 앞에 오는 경우
//   NAKAIZUO_2nd【●】               ← 상품명 없는 경우 (defaultProduct 적용)
// ---------------------------------------------------------------------------
const PRIORITY_MARKER_RE = /【●】/g;
// 버전 토큰: _ + 숫자 + 서수 접미사, 뒤에 _ 또는 문자열 끝이 오는 위치에서 매칭
const VERSION_RE = /_(\d+)(st|nd|rd|th)(?=_|$)/i;

function parseWpTeamName(
  rawName: string,
  sport: string
): { teamName: string; product: string; version: number } {
  const products: readonly string[] =
    DESIGN_PRODUCTS_BY_SPORT[sport as DesignSportForProduct] ?? [];
  const defaultProduct = defaultProductForSport(sport);

  // 1. 【●】 제거 (isPriority는 requests 데이터에서 별도 처리됨)
  let name = rawName.replace(PRIORITY_MARKER_RE, '');

  // 2. 버전 추출 — 문자열 내 어디서든 _Nst/nd/rd/th 를 찾고 제거
  const versionMatch = name.match(VERSION_RE);
  let version = 1;
  if (versionMatch && versionMatch.index !== undefined) {
    version = parseInt(versionMatch[1], 10);
    // 버전 토큰 제거 후 양쪽 남은 조각을 합침
    name = (name.slice(0, versionMatch.index) + name.slice(versionMatch.index + versionMatch[0].length));
  }

  // 연속 언더스코어·앞뒤 언더스코어 정리
  name = name.replace(/__+/g, '_').replace(/^_+|_+$/g, '').trim();

  // 3. 상품명 추출 (끝에서 매칭)
  for (const p of products) {
    const suffix = '_' + p;
    if (name.endsWith(suffix)) {
      const teamName = name.slice(0, name.length - suffix.length).trim();
      if (teamName) return { teamName, product: p, version };
    }
  }

  return { teamName: name || rawName.trim(), product: defaultProduct, version };
}

// ---------------------------------------------------------------------------
// GET /admin/design-request-bk/sports
// ---------------------------------------------------------------------------
export async function listBkSports(req: AuthRequest, res: Response) {
  const result: Array<{ sport: string; teamCount: number; requestCount: number; fileExists: boolean }> = [];

  for (const sport of VALID_SPORTS) {
    const filePath = path.join(WP_DATA_DIR, `${sport}.json`);
    if (!fs.existsSync(filePath)) {
      result.push({ sport, teamCount: 0, requestCount: 0, fileExists: false });
      continue;
    }
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw) as { teams: Array<{ requests: unknown[] }> };
      const teamCount = data.teams.length;
      const requestCount = data.teams.reduce((s, t) => s + t.requests.length, 0);
      result.push({ sport, teamCount, requestCount, fileExists: true });
    } catch {
      result.push({ sport, teamCount: 0, requestCount: 0, fileExists: false });
    }
  }

  return res.json(result);
}

// ---------------------------------------------------------------------------
// GET /admin/design-request-bk/users
// 전체 활성 사용자 목록 (매핑 UI 용)
// ---------------------------------------------------------------------------
export async function listBkUsers(req: AuthRequest, res: Response) {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      email: true,
      profile: { select: { name: true } },
    },
    orderBy: { email: 'asc' },
  });
  return res.json(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.profile?.name || u.email,
    }))
  );
}

// ---------------------------------------------------------------------------
// 공통: teams 배열을 받아 design_requests에 import
// - req[0]  → DesignRequest + DesignRequestAttachment
// - req[1+] → DesignRequestReply(RE_REQUEST) + DesignRequestReplyAttachment
// ---------------------------------------------------------------------------
interface WpImageEntry {
  url: string;
  s3Key: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface WpRequestEntry {
  index: number;
  text: string;
  status: string;
  date: string;
  isPriority: boolean;
  isWorking: boolean;
  isReviewed: boolean;
  images: WpImageEntry[];
}

interface WpTeamEntry {
  wpPostId: string;
  teamName: string;
  sport: string;
  wpCreator?: string;  // dc:creator (업데이트된 파서에서만 존재)
  requests: WpRequestEntry[];
}

const STATUS_MAP: Record<string, 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'> = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
};

/** WP 이미지 → 첨부 레코드용 s3Key 결정: url 우선, 없으면 S3 버킷 URL 조합 */
function resolveImageS3Key(img: WpImageEntry): string {
  if (img.url && img.url.startsWith('http')) return img.url;
  if (img.s3Key) return `https://design-max-uploads.s3.amazonaws.com/${img.s3Key}`;
  return '';
}

async function doImport(
  teams: WpTeamEntry[],
  sport: ValidSport,
  defaultRequesterId: string,
  options: {
    userMapping?: Record<string, string>; // wpCreator → requesterId
    designerMapping?: Record<string, string>; // wpCreator → assigneeId (향후 확장)
    assigneeId?: string | null; // import 시 모든 초기 요청에 공통 담당자
  } = {}
): Promise<{ created: number; skipped: number; errors: number }> {

  // ── 기존 초기 요청 마커 로드 (req[0] 및 구버전 req[n] 모두 포함) ──
  const existingRequests = await prisma.designRequest.findMany({
    where: { sport, initialRequest: { contains: '[WP_IMPORT:' } },
    select: { id: true, initialRequest: true },
  });

  const importedInitialKeys = new Set<string>(); // "{postId}_{idx}"
  const initialKey0ToId = new Map<string, string>(); // "{postId}_0" → designRequestId

  for (const r of existingRequests) {
    const m = r.initialRequest.match(/\[WP_IMPORT:(\d+)_(\d+)\]/);
    if (m) {
      const key = `${m[1]}_${m[2]}`;
      importedInitialKeys.add(key);
      if (m[2] === '0') initialKey0ToId.set(key, r.id);
    }
  }

  // ── 기존 답변 마커 로드 ──
  const existingReplies = await prisma.designRequestReply.findMany({
    where: {
      content: { contains: '[WP_IMPORT:' },
      designRequest: { sport },
    },
    select: { content: true },
  });

  const importedReplyKeys = new Set<string>();
  for (const r of existingReplies) {
    const m = r.content.match(/\[WP_IMPORT:(\d+)_(\d+)\]/);
    if (m) importedReplyKeys.add(`${m[1]}_${m[2]}`);
  }

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const team of teams) {
    if (!team.requests || team.requests.length === 0) { skipped++; continue; }

    // 등록자 결정: userMapping[wpCreator] → fallback to caller
    const requesterId =
      (team.wpCreator && options.userMapping?.[team.wpCreator]) || defaultRequesterId;

    const parsed = parseWpTeamName(team.teamName, sport);

    // ── req[0]: DesignRequest ──────────────────────────────────────────────
    const req0 = team.requests[0];
    const key0 = `${team.wpPostId}_0`;
    let designRequestId = initialKey0ToId.get(key0) ?? null;

    if (!designRequestId) {
      if (importedInitialKeys.has(key0)) {
        // 이미 import됨, ID만 찾기
        skipped++;
      } else {
        try {
          const marker = `[WP_IMPORT:${key0}]`;
          const requestText = (req0?.text || '').trim();
          const status = STATUS_MAP[req0?.status] || 'PENDING';

          let createdAt: Date | undefined;
          if (req0?.date) {
            const d = new Date(req0.date.replace(' ', 'T') + '+09:00');
            if (!isNaN(d.getTime())) createdAt = d;
          }

          const attachData = (req0?.images || [])
            .map(resolveImageS3Key)
            .filter(Boolean)
            .map((s3Key, idx) => {
              const img = req0.images[idx];
              return {
                filename: img.filename || 'image',
                s3Key,
                mimeType: img.mimeType || 'image/jpeg',
                size: img.size || 0,
                sortOrder: idx,
              };
            });

          const dr = await prisma.designRequest.create({
            data: {
              sport,
              teamName: parsed.teamName,
              product: parsed.product,
              version: parsed.version,
              initialRequest: marker + (requestText ? ' ' + requestText : ''),
              initialRequestLang: 'ja',
              priorityFirst: req0?.isPriority ?? false,
              status,
              requesterId,
              assigneeId: options.assigneeId || null,
              createdAt: createdAt || new Date(),
              attachments: { create: attachData },
            },
          });

          designRequestId = dr.id;
          initialKey0ToId.set(key0, dr.id);
          importedInitialKeys.add(key0);
          created++;
        } catch (e) {
          console.error('[BK Import] req[0] 오류:', team.teamName, e);
          errors++;
          continue;
        }
      }
    }

    // ── req[1+]: DesignRequestReply(RE_REQUEST) ────────────────────────────
    for (let i = 1; i < team.requests.length; i++) {
      const req = team.requests[i];
      const keyI = `${team.wpPostId}_${i}`;

      // 구버전(초기 요청으로 개별 저장됨) 또는 신버전(답변으로 저장됨) 모두 체크
      if (importedInitialKeys.has(keyI) || importedReplyKeys.has(keyI)) {
        skipped++;
        continue;
      }
      if (!req.text && (!req.images || req.images.length === 0)) continue;
      if (!designRequestId) { skipped++; continue; }

      try {
        const marker = `[WP_IMPORT:${keyI}]`;
        const content = marker + (req.text ? ' ' + req.text.trim() : '');

        let createdAt: Date | undefined;
        if (req.date) {
          const d = new Date(req.date.replace(' ', 'T') + '+09:00');
          if (!isNaN(d.getTime())) createdAt = d;
        }

        const attachData = (req.images || [])
          .map(resolveImageS3Key)
          .filter(Boolean)
          .map((s3Key, idx) => {
            const img = req.images[idx];
            return {
              filename: img.filename || 'image',
              s3Key,
              mimeType: img.mimeType || 'image/jpeg',
              size: img.size || 0,
              sortOrder: idx,
            };
          });

        await prisma.designRequestReply.create({
          data: {
            designRequestId,
            userId: requesterId,
            kind: 'RE_REQUEST',
            content,
            createdAt: createdAt || new Date(),
            attachments: { create: attachData },
          },
        });

        importedReplyKeys.add(keyI);
        created++;
      } catch (e) {
        console.error('[BK Import] reply 오류:', team.teamName, i, e);
        errors++;
      }
    }
  }

  return { created, skipped, errors };
}

// ---------------------------------------------------------------------------
// POST /admin/design-request-bk/import/:sport
// ---------------------------------------------------------------------------
const importBodySchema = z.object({
  teams: z.array(
    z.object({
      wpPostId: z.string(),
      teamName: z.string(),
      sport: z.string(),
      wpCreator: z.string().optional(),
      requests: z.array(
        z.object({
          index: z.number(),
          text: z.string(),
          status: z.string(),
          date: z.string(),
          isPriority: z.boolean().optional().default(false),
          isWorking: z.boolean().optional().default(false),
          isReviewed: z.boolean().optional().default(false),
          images: z
            .array(
              z.object({
                url: z.string(),
                s3Key: z.string(),
                filename: z.string(),
                mimeType: z.string(),
                size: z.number(),
              })
            )
            .optional()
            .default([]),
        })
      ),
    })
  ),
  assigneeId: z.string().optional(),
  userMapping: z.record(z.string(), z.string()).optional(),
});

/** 가져오기/패치 공통 — 본문에는 매핑·담당자만 (teams는 서버 파일에서 읽음, 413 Payload 회피) */
const bkImportOptionsSchema = z.object({
  assigneeId: z.string().optional(),
  userMapping: z.record(z.string(), z.string()).optional(),
});

export async function importBkSport(req: AuthRequest, res: Response) {
  const sport = req.params.sport?.toUpperCase();
  if (!VALID_SPORTS.includes(sport as ValidSport)) {
    return res.status(400).json({ message: '유효하지 않은 종목입니다.' });
  }

  const parsed = importBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'JSON 형식이 올바르지 않습니다.', issues: parsed.error.issues });
  }

  const { teams, assigneeId, userMapping } = parsed.data;

  const { created, skipped, errors } = await doImport(
    teams as WpTeamEntry[],
    sport as ValidSport,
    req.user!.id,
    { assigneeId, userMapping }
  );

  return res.json({
    sport,
    created,
    skipped,
    errors,
    message: `${created}개 가져오기 완료 (건너뜀: ${skipped}, 오류: ${errors})`,
  });
}

// ---------------------------------------------------------------------------
// POST /admin/design-request-bk/import-from-disk/:sport
// — backend/data/wp/{SPORT}.json 을 서버에서 직접 읽어 import (역프록시 body 크기 제한 회피)
// ---------------------------------------------------------------------------
export async function importBkSportFromDisk(req: AuthRequest, res: Response) {
  const sport = req.params.sport?.toUpperCase();
  if (!VALID_SPORTS.includes(sport as ValidSport)) {
    return res.status(400).json({ message: '유효하지 않은 종목입니다.' });
  }

  const filePath = path.join(WP_DATA_DIR, `${sport}.json`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: '서버에 해당 종목 JSON 파일이 없습니다. 배포에 backend/data/wp 를 포함했는지 확인하세요.' });
  }

  let fileData: unknown;
  try {
    fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return res.status(400).json({ message: '서버 JSON 파일을 읽거나 파싱할 수 없습니다.' });
  }

  const opts = bkImportOptionsSchema.safeParse(req.body ?? {});
  if (!opts.success) {
    return res.status(400).json({ message: '요청 본문 형식이 올바르지 않습니다.', issues: opts.error.issues });
  }

  const teams = (fileData as { teams?: unknown }).teams;
  const parsed = importBodySchema.safeParse({
    teams,
    assigneeId: opts.data.assigneeId,
    userMapping: opts.data.userMapping,
  });
  if (!parsed.success) {
    return res.status(400).json({ message: 'JSON 형식이 올바르지 않습니다.', issues: parsed.error.issues });
  }

  const { teams: teamList, assigneeId, userMapping } = parsed.data;

  const { created, skipped, errors } = await doImport(
    teamList as WpTeamEntry[],
    sport as ValidSport,
    req.user!.id,
    { assigneeId, userMapping }
  );

  return res.json({
    sport,
    created,
    skipped,
    errors,
    message: `${created}개 가져오기 완료 (건너뜀: ${skipped}, 오류: ${errors})`,
  });
}

// ---------------------------------------------------------------------------
// DELETE /admin/design-request-bk/import/:sport
// 해당 스포츠의 BK import 데이터만 삭제 (WP_IMPORT 마커 기준)
// DesignRequest CASCADE 삭제 시 replies 도 함께 삭제됨
// ---------------------------------------------------------------------------
export async function deleteBkImport(req: AuthRequest, res: Response) {
  const sport = req.params.sport?.toUpperCase();
  if (!VALID_SPORTS.includes(sport as ValidSport)) {
    return res.status(400).json({ message: '유효하지 않은 종목입니다.' });
  }

  const deleted = await prisma.designRequest.deleteMany({
    where: {
      sport: sport as ValidSport,
      initialRequest: { contains: '[WP_IMPORT:' },
    },
  });

  return res.json({
    sport,
    deleted: deleted.count,
    message: `${deleted.count}개 삭제 완료`,
  });
}

// ---------------------------------------------------------------------------
// POST /admin/design-request-bk/patch-images/:sport
// 이미 import된 레코드에 이미지만 덮어쓰기 (WP_IMPORT 마커 기준으로 매칭)
// - 기존 첨부가 없는 req[0]에만 CSV 이미지를 추가
// - 기존 첨부가 이미 있으면 스킵 (중복 방지)
// - 매칭 레코드가 없으면 신규 생성 (일반 import와 동일)
// ---------------------------------------------------------------------------
const patchBodySchema = z.object({
  teams: z.array(
    z.object({
      wpPostId: z.string(),
      teamName: z.string(),
      sport: z.string(),
      wpCreator: z.string().optional(),
      requests: z.array(
        z.object({
          index: z.number(),
          text: z.string(),
          status: z.string(),
          date: z.string(),
          isPriority: z.boolean().optional().default(false),
          isWorking: z.boolean().optional().default(false),
          isReviewed: z.boolean().optional().default(false),
          images: z
            .array(
              z.object({
                url: z.string(),
                s3Key: z.string(),
                filename: z.string(),
                mimeType: z.string(),
                size: z.number(),
              })
            )
            .optional()
            .default([]),
        })
      ),
    })
  ),
  assigneeId: z.string().optional(),
  userMapping: z.record(z.string(), z.string()).optional(),
});

export async function patchBkImages(req: AuthRequest, res: Response) {
  const sport = req.params.sport?.toUpperCase();
  if (!VALID_SPORTS.includes(sport as ValidSport)) {
    return res.status(400).json({ message: '유효하지 않은 종목입니다.' });
  }

  const parsed = patchBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'JSON 형식이 올바르지 않습니다.', issues: parsed.error.issues });
  }

  const { teams, assigneeId, userMapping } = parsed.data;

  // 기존 import 레코드 마커 → designRequestId 맵 구축
  const existingRequests = await prisma.designRequest.findMany({
    where: { sport: sport as ValidSport, initialRequest: { contains: '[WP_IMPORT:' } },
    select: {
      id: true,
      initialRequest: true,
      _count: { select: { attachments: true } },
    },
  });

  const markerToRecord = new Map<string, { id: string; attachCount: number }>();
  for (const r of existingRequests) {
    const m = r.initialRequest.match(/\[WP_IMPORT:(\d+)_0\]/);
    if (m) {
      markerToRecord.set(m[1], { id: r.id, attachCount: r._count.attachments });
    }
  }

  let patched = 0;
  let created = 0;
  let skipped = 0;
  let errors  = 0;

  for (const team of teams as WpTeamEntry[]) {
    if (!team.requests || team.requests.length === 0) { skipped++; continue; }

    const req0    = team.requests[0];
    const images  = req0?.images || [];
    if (images.length === 0) { skipped++; continue; }

    const existing = markerToRecord.get(team.wpPostId);

    if (existing) {
      // 이미 첨부가 있으면 스킵
      if (existing.attachCount > 0) { skipped++; continue; }

      // 첨부 없는 기존 레코드에 이미지 추가
      try {
        const attachData = images
          .map(resolveImageS3Key)
          .filter(Boolean)
          .map((s3Key, idx) => {
            const img = images[idx];
            return {
              filename: img.filename || 'image',
              s3Key,
              mimeType: img.mimeType || 'image/jpeg',
              size: img.size || 0,
              sortOrder: idx,
            };
          });

        await prisma.designRequestAttachment.createMany({
          data: attachData.map((a) => ({ ...a, designRequestId: existing.id })),
        });
        patched++;
      } catch (e) {
        console.error('[BK Patch] 이미지 추가 오류:', team.teamName, e);
        errors++;
      }
    } else {
      // 기존 레코드 없음 → 신규 생성 (일반 import 로직 위임)
      const requesterId =
        (team.wpCreator && userMapping?.[team.wpCreator]) || req.user!.id;
      const result = await doImport([team], sport as ValidSport, requesterId, { assigneeId, userMapping });
      created += result.created;
      errors  += result.errors;
    }
  }

  return res.json({
    sport,
    patched,
    created,
    skipped,
    errors,
    message: `이미지 패치 완료 — 덮어쓰기: ${patched}, 신규생성: ${created}, 건너뜀: ${skipped}, 오류: ${errors}`,
  });
}

// ---------------------------------------------------------------------------
// POST /admin/design-request-bk/patch-images-from-disk/:sport
// — 서버 JSON으로 이미지 패치 (본문 대용량 전송 없음)
// ---------------------------------------------------------------------------
export async function patchBkImagesFromDisk(req: AuthRequest, res: Response) {
  const sport = req.params.sport?.toUpperCase();
  if (!VALID_SPORTS.includes(sport as ValidSport)) {
    return res.status(400).json({ message: '유효하지 않은 종목입니다.' });
  }

  const filePath = path.join(WP_DATA_DIR, `${sport}.json`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: '서버에 해당 종목 JSON 파일이 없습니다.' });
  }

  let fileData: unknown;
  try {
    fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return res.status(400).json({ message: '서버 JSON 파일을 읽거나 파싱할 수 없습니다.' });
  }

  const opts = bkImportOptionsSchema.safeParse(req.body ?? {});
  if (!opts.success) {
    return res.status(400).json({ message: '요청 본문 형식이 올바르지 않습니다.', issues: opts.error.issues });
  }

  const teams = (fileData as { teams?: unknown }).teams;
  const parsed = patchBodySchema.safeParse({
    teams,
    assigneeId: opts.data.assigneeId,
    userMapping: opts.data.userMapping,
  });
  if (!parsed.success) {
    return res.status(400).json({ message: 'JSON 형식이 올바르지 않습니다.', issues: parsed.error.issues });
  }

  req.body = parsed.data;
  return patchBkImages(req, res);
}

// ---------------------------------------------------------------------------
// DELETE /admin/design-request-bk/all
// design_requests 전체 삭제 — 비밀번호 필요
// ---------------------------------------------------------------------------
const DELETE_ALL_PASSWORD = '1750';

export async function deleteAllDesignRequests(req: AuthRequest, res: Response) {
  const { password } = req.body as { password?: string };
  if (password !== DELETE_ALL_PASSWORD) {
    return res.status(403).json({ message: '비밀번호가 올바르지 않습니다.' });
  }

  const deleted = await prisma.designRequest.deleteMany({});

  return res.json({
    deleted: deleted.count,
    message: `디자인 요청 전체 ${deleted.count}개 삭제 완료`,
  });
}

// ---------------------------------------------------------------------------
// GET /admin/design-request-bk/img-proxy?url=...
// WP 이미지 hotlink 우회 프록시
// ---------------------------------------------------------------------------
export async function imgProxy(req: AuthRequest, res: Response) {
  const { url } = req.query as { url?: string };
  if (!url || !url.startsWith('http')) {
    return res.status(400).json({ message: '유효하지 않은 URL' });
  }

  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith('max2max.jp') && !parsed.hostname.endsWith('amazonaws.com')) {
      return res.status(403).json({ message: '허용되지 않는 도메인' });
    }
  } catch {
    return res.status(400).json({ message: '잘못된 URL' });
  }

  const lib = url.startsWith('https') ? https : http;

  return new Promise<void>((resolve) => {
    const request = lib.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://design.max2max.jp/',
        },
      },
      (upstream) => {
        if (upstream.statusCode && upstream.statusCode >= 400) {
          res.status(upstream.statusCode).end();
          resolve();
          return;
        }
        const ct = upstream.headers['content-type'] || 'image/jpeg';
        res.setHeader('Content-Type', ct);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        upstream.pipe(res);
        upstream.on('end', resolve);
      }
    );
    request.on('error', () => { res.status(502).end(); resolve(); });
    request.setTimeout(10000, () => { request.destroy(); res.status(504).end(); resolve(); });
  });
}
