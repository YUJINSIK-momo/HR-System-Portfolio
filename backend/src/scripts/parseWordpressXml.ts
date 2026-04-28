/**
 * designmax.WordPress.xml → 스포츠별 JSON 변환 스크립트
 *
 * 사용법 (backend 폴더에서):
 *   npx ts-node src/scripts/parseWordpressXml.ts [XML파일경로]
 *
 * 기본 경로: 프로젝트 루트의 designmax.WordPress.2026-04-09.xml
 * 출력:
 *   - backend/data/wp/{sport}.json          … 전체 합본 (기존 호환)
 *   - backend/data/wp/{sport}_2025.json     … 연도 < 2026 (2025 이하·레거시 포함)
 *   - backend/data/wp/{sport}_2026.json     … 연도 ≥ 2026 팀 1/3 (wpPostId 정렬)
 *   - backend/data/wp/{sport}_2026b.json      … 2/3
 *   - backend/data/wp/{sport}_2026c.json      … 3/3 (용량 3분할)
 *
 * 연도 판별: 각 요청의 request_date 중 가장 늦은 날짜의 연도 → 없으면 팀 wp:post_date
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// 스포츠 매핑 (WP sport_category → DB DesignRequestSport)
// ---------------------------------------------------------------------------
const SPORT_MAP: Record<string, string> = {
  soccer: 'SOCCER',
  basketball: 'BASKETBALL',
  baseball_in: 'BASEBALL',
  baseball_indoor: 'BASEBALL',
  baseball_out: 'BASEBALL_HOF',
  baseball_outdoor: 'BASEBALL_HOF',
  volleyball: 'VOLLEYBALL',
};

// ---------------------------------------------------------------------------
// 상태 매핑 (WP request_status → DB DesignRequestStatus)
// ---------------------------------------------------------------------------
function mapStatus(wpStatus: string): string {
  switch (wpStatus.trim()) {
    case '1': return 'COMPLETED';
    case '2': return 'IN_PROGRESS';
    default:  return 'PENDING';
  }
}

// ---------------------------------------------------------------------------
// PHP serialized array 파싱 (이미지 ID 추출)
// e.g. "a:2:{i:0;s:5:\"12345\";i:1;s:5:\"67890\";}"
// ---------------------------------------------------------------------------
function parsePhpSerializedIds(serialized: string): string[] {
  const ids: string[] = [];
  const regex = /s:\d+:"(\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(serialized)) !== null) {
    ids.push(m[1]);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// CDATA 값 추출 — 정규식 대신 문자열 검색 사용 (이스케이프 문제 방지)
// ---------------------------------------------------------------------------
const CDATA_OPEN = '<![CDATA[';
const CDATA_CLOSE = ']]>';

function extractCdata(text: string, fullTag: string): string {
  // e.g. fullTag = 'wp:post_type'
  const open = '<' + fullTag + '>' + CDATA_OPEN;
  const close = CDATA_CLOSE + '</' + fullTag + '>';
  const start = text.indexOf(open);
  if (start === -1) return '';
  const valueStart = start + open.length;
  const end = text.indexOf(close, valueStart);
  if (end === -1) return '';
  return text.slice(valueStart, end);
}

/** CDATA 없이 직접 태그 값 추출 e.g. <wp:post_id>656</wp:post_id> */
function extractTagValue(text: string, fullTag: string): string {
  const open = '<' + fullTag + '>';
  const close = '</' + fullTag + '>';
  const start = text.indexOf(open);
  if (start === -1) return '';
  const valueStart = start + open.length;
  const end = text.indexOf(close, valueStart);
  if (end === -1) return '';
  // CDATA 내부인 경우 CDATA를 벗겨냄
  let val = text.slice(valueStart, end).trim();
  if (val.startsWith(CDATA_OPEN) && val.endsWith(CDATA_CLOSE)) {
    val = val.slice(CDATA_OPEN.length, val.length - CDATA_CLOSE.length);
  }
  return val;
}

function extractMeta(itemText: string, metaKey: string): string {
  // <wp:meta_key><![CDATA[KEY]]></wp:meta_key>
  //   ...whitespace...
  // <wp:meta_value><![CDATA[VALUE]]></wp:meta_value>
  const keyOpen = '<wp:meta_key>' + CDATA_OPEN + metaKey + CDATA_CLOSE + '</wp:meta_key>';
  const keyIdx = itemText.indexOf(keyOpen);
  if (keyIdx === -1) return '';

  const afterKey = itemText.indexOf('<wp:meta_value>', keyIdx + keyOpen.length);
  if (afterKey === -1) return '';

  const valOpen = '<wp:meta_value>' + CDATA_OPEN;
  const valStart = itemText.indexOf(valOpen, afterKey);
  if (valStart === -1) return '';

  const contentStart = valStart + valOpen.length;
  const valClose = CDATA_CLOSE + '</wp:meta_value>';
  const contentEnd = itemText.indexOf(valClose, contentStart);
  if (contentEnd === -1) return '';

  return itemText.slice(contentStart, contentEnd);
}

// ---------------------------------------------------------------------------
// 첨부 메타에서 filesize 추출
// ---------------------------------------------------------------------------
function extractFilesize(metaValue: string): number {
  const m = metaValue.match(/s:8:"filesize";i:(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

// ---------------------------------------------------------------------------
// mimeType 추출 (확장자 기반)
// ---------------------------------------------------------------------------
function mimeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    pdf: 'application/pdf',
    heic: 'image/heic',
    heif: 'image/heif',
  };
  return map[ext] || 'image/jpeg';
}

// ---------------------------------------------------------------------------
// 메인
// ---------------------------------------------------------------------------
interface AttachmentInfo {
  url: string;
  s3Key: string;  // _wp_attached_file (e.g. "2025/10/filename.png") — design-max-uploads 버킷 키
  filename: string;
  mimeType: string;
  size: number;
}

interface WpRequest {
  index: number;
  text: string;
  status: string;
  date: string;
  isPriority: boolean;
  isWorking: boolean;
  isReviewed: boolean;
  images: AttachmentInfo[];
}

interface WpTeam {
  wpPostId: string;
  teamName: string;
  sport: string;
  wpCreator: string;  // dc:creator — WP 작성자 username
  requests: WpRequest[];
}

interface SportData {
  sport: string;
  teams: WpTeam[];
}

/** YYYY… 형태 날짜에서 연도만 추출 */
function parseYearFromDateString(s: string): number | null {
  const m = s.trim().match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * 팀이 들어갈 연도 (단일 숫자).
 * - 요청일 중 최대 연도 우선
 * - 없으면 wp:post_date
 */
function resolveTeamYear(block: string, requests: WpRequest[]): number {
  let maxY = 0;
  for (const r of requests) {
    const y = parseYearFromDateString(r.date);
    if (y !== null && y > maxY) maxY = y;
  }
  if (maxY > 0) return maxY;
  const postDate = extractCdata(block, 'wp:post_date');
  const py = parseYearFromDateString(postDate);
  if (py !== null && py > 0) return py;
  return 2025;
}

/** 2025 파일 vs 2026 버킷 — 2026년 이후 활동은 2026 버킷(출력 시 2026 / 2026b / 2026c 로 3분할) */
function yearFileSuffix(year: number): '2025' | '2026' {
  return year >= 2026 ? '2026' : '2025';
}

/** 2026 버킷 팀을 wpPostId → 팀명 순으로 정렬한 뒤 가능한 한 균등하게 3분할 */
function split2026TeamsIntoThirds(teams: WpTeam[]): [WpTeam[], WpTeam[], WpTeam[]] {
  if (teams.length === 0) return [[], [], []];
  const sorted = [...teams].sort((a, b) => {
    const na = parseInt(a.wpPostId, 10) || 0;
    const nb = parseInt(b.wpPostId, 10) || 0;
    if (na !== nb) return na - nb;
    return a.teamName.localeCompare(b.teamName, 'ko');
  });
  const n = sorted.length;
  const base = Math.floor(n / 3);
  const rem = n % 3;
  const s0 = base + (rem > 0 ? 1 : 0);
  const s1 = base + (rem > 1 ? 1 : 0);
  const i1 = s0;
  const i2 = s0 + s1;
  return [sorted.slice(0, i1), sorted.slice(i1, i2), sorted.slice(i2)];
}

function main() {
  const xmlPath = process.argv[2]
    || path.resolve(__dirname, '../../..', 'designmax.WordPress.2026-04-09.xml');
  const outputDir = path.resolve(__dirname, '../..', 'data/wp');

  if (!fs.existsSync(xmlPath)) {
    console.error('XML 파일을 찾을 수 없습니다:', xmlPath);
    process.exit(1);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('XML 읽는 중... (약 94MB)');
  const raw = fs.readFileSync(xmlPath, 'utf8');

  // ── 1. <item> 블록 분리 ──────────────────────────────────────────────────
  console.log('아이템 블록 분리 중...');
  const blocks = raw.split('</item>').filter((b) => b.includes('<item>'));
  console.log(`총 아이템 수: ${blocks.length}`);

  // ── 2. attachment 맵 구축 ────────────────────────────────────────────────
  console.log('attachment 맵 구축 중...');
  const attachmentMap = new Map<string, AttachmentInfo>();

  for (const block of blocks) {
    const postType = extractCdata(block, 'wp:post_type');
    if (postType !== 'attachment') continue;

    const postId = extractTagValue(block, 'wp:post_id');
    if (!postId) continue;

    // attachment_url 직접 추출
    const urlOpen = '<wp:attachment_url>' + CDATA_OPEN;
    const urlClose = CDATA_CLOSE + '</wp:attachment_url>';
    const urlStart = block.indexOf(urlOpen);
    let url = '';
    if (urlStart !== -1) {
      const vStart = urlStart + urlOpen.length;
      const vEnd = block.indexOf(urlClose, vStart);
      if (vEnd !== -1) url = block.slice(vStart, vEnd);
    }

    const s3Key = extractMeta(block, '_wp_attached_file');
    const metadataStr = extractMeta(block, '_wp_attachment_metadata');
    const size = extractFilesize(metadataStr);
    const filename = path.basename(s3Key || url || 'image');
    const mimeType = mimeFromFilename(filename);

    attachmentMap.set(postId, { url, s3Key, filename, mimeType, size });
  }

  console.log(`attachment 맵 크기: ${attachmentMap.size}`);

  // ── 3. team 포스트 처리 ──────────────────────────────────────────────────
  console.log('team 포스트 처리 중...');
  /** 합본: SOCCER, BASEBALL, … */
  const sportDataMap = new Map<string, SportData>();
  /** 연도별: SOCCER_2025 / SOCCER_2026 … */
  const sportYearDataMap = new Map<string, SportData>();

  let teamCount = 0;
  let skipCount = 0;

  for (const block of blocks) {
    const postType = extractCdata(block, 'wp:post_type');
    if (postType !== 'team') continue;

    const postStatus = extractCdata(block, 'wp:status');
    if (postStatus === 'trash') { skipCount++; continue; }

    const wpPostId = extractTagValue(block, 'wp:post_id');
    // title는 CDATA 없이 plain text인 경우도 있음
    const titleOpen = '<title>';
    const titleClose = '</title>';
    let teamName = '';
    const tStart = block.indexOf(titleOpen);
    if (tStart !== -1) {
      const afterTag = tStart + titleOpen.length;
      const cdataIdx = block.indexOf(CDATA_OPEN, afterTag);
      const tEnd = block.indexOf(titleClose, afterTag);
      if (cdataIdx !== -1 && cdataIdx < tEnd) {
        // <title><![CDATA[value]]></title>
        const contentStart = cdataIdx + CDATA_OPEN.length;
        const contentEnd = block.indexOf(CDATA_CLOSE, contentStart);
        if (contentEnd !== -1) teamName = block.slice(contentStart, contentEnd).trim();
      } else if (tEnd !== -1) {
        teamName = block.slice(afterTag, tEnd).trim();
      }
    }

    // WP 작성자 (dc:creator)
    const wpCreator = extractCdata(block, 'dc:creator');

    const wpSport = extractMeta(block, 'sport_category');
    const dbSport = SPORT_MAP[wpSport];
    if (!dbSport) { skipCount++; continue; }

    // requests 개수
    const requestCountStr = extractMeta(block, 'requests');
    const requestCount = parseInt(requestCountStr, 10) || 0;

    const wpRequests: WpRequest[] = [];

    for (let i = 0; i < requestCount; i++) {
      const text = extractMeta(block, `requests_${i}_request_text`);
      const statusStr = extractMeta(block, `requests_${i}_request_status`);
      const date = extractMeta(block, `requests_${i}_request_date`);
      const isPriority = extractMeta(block, `requests_${i}_is_priority`) === '1';
      const isWorking = extractMeta(block, `requests_${i}_is_working`) === '1';
      const isReviewed = extractMeta(block, `requests_${i}_is_reviewed`) === '1';
      const imagesRaw = extractMeta(block, `requests_${i}_request_images`);

      // PHP serialized 이미지 ID → AttachmentInfo 매핑
      const imageIds = parsePhpSerializedIds(imagesRaw);
      const images: AttachmentInfo[] = [];
      for (const id of imageIds) {
        const info = attachmentMap.get(id);
        if (info) images.push(info);
      }

      wpRequests.push({
        index: i,
        text: text.trim(),
        status: mapStatus(statusStr),
        date: date.trim(),
        isPriority,
        isWorking,
        isReviewed,
        images,
      });
    }

    const team: WpTeam = { wpPostId, teamName, sport: dbSport, wpCreator, requests: wpRequests };

    if (!sportDataMap.has(dbSport)) {
      sportDataMap.set(dbSport, { sport: dbSport, teams: [] });
    }
    sportDataMap.get(dbSport)!.teams.push(team);

    const y = resolveTeamYear(block, wpRequests);
    const suffix = yearFileSuffix(y);
    const yearKey = `${dbSport}_${suffix}`;
    if (!sportYearDataMap.has(yearKey)) {
      sportYearDataMap.set(yearKey, { sport: dbSport, teams: [] });
    }
    sportYearDataMap.get(yearKey)!.teams.push(team);

    teamCount++;
  }

  console.log(`처리된 팀: ${teamCount}, 건너뜀: ${skipCount}`);

  // ── 4. JSON 파일 출력 ────────────────────────────────────────────────────
  for (const [sport, data] of sportDataMap) {
    const outPath = path.join(outputDir, `${sport}.json`);
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`✅ ${sport} (합본): ${data.teams.length}팀 → ${outPath}`);
  }

  const sortedSplitKeys = Array.from(sportYearDataMap.keys()).sort();
  for (const key of sortedSplitKeys) {
    const data = sportYearDataMap.get(key)!;
    if (data.teams.length === 0) continue;

    if (key.endsWith('_2026')) {
      const [partA, partB, partC] = split2026TeamsIntoThirds(data.teams);
      const sport = data.sport;
      const out1 = path.join(outputDir, `${sport}_2026.json`);
      const out2 = path.join(outputDir, `${sport}_2026b.json`);
      const out3 = path.join(outputDir, `${sport}_2026c.json`);
      fs.writeFileSync(out1, JSON.stringify({ sport, teams: partA }, null, 2), 'utf8');
      fs.writeFileSync(out2, JSON.stringify({ sport, teams: partB }, null, 2), 'utf8');
      fs.writeFileSync(out3, JSON.stringify({ sport, teams: partC }, null, 2), 'utf8');
      console.log(`✅ ${sport}_2026: ${partA.length}팀 (1/3) → ${out1}`);
      console.log(`✅ ${sport}_2026b: ${partB.length}팀 (2/3) → ${out2}`);
      console.log(`✅ ${sport}_2026c: ${partC.length}팀 (3/3) → ${out3}`);
    } else {
      const outPath = path.join(outputDir, `${key}.json`);
      fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`✅ ${key}: ${data.teams.length}팀 → ${outPath}`);
    }
  }

  console.log(
    '\n완료! data/wp/ 에 합본({sport}.json), {sport}_2025.json, {sport}_2026·_2026b·_2026c.json(2026 3분할) 저장.'
  );
}

main();
