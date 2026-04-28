/**
 * CSV(팀 Export) + XML(WordPress) 병합 → BK Import JSON (2026년 1월 이후)
 *
 * 사용법 (backend 폴더에서):
 *   npx ts-node src/scripts/csvMergeToJson.ts [CSV경로] [XML경로]
 *
 * 기본 경로: 프로젝트 루트의 파일
 * 출력: backend/data/wp/{SPORT}_2026.json · _2026b.json · _2026c.json (wpPostId 순 3분할)
 *
 * 동작:
 *   XML  → sport, wpCreator, request 텍스트/상태/날짜/플래그 (이미지 ID 제외)
 *   CSV  → 2026-01 이후 팀의 이미지 URL (S3)
 *   병합 → postId 기준으로 XML 메타 + CSV 이미지 결합
 *          XML에 없는 팀(4/10 이후 신규)은 sport='UNKNOWN'
 */

import * as fs from 'fs';
import * as path from 'path';

// ── 상수 ──────────────────────────────────────────────────────────────────
const S3_PREFIX   = 'https://design-max-uploads.s3.ap-northeast-2.amazonaws.com/';
const WP_PREFIX   = 'https://design.max2max.jp/';
const CDATA_OPEN  = '<![CDATA[';
const CDATA_CLOSE = ']]>';

const SPORT_MAP: Record<string, string> = {
  soccer:           'SOCCER',
  basketball:       'BASKETBALL',
  baseball_in:      'BASEBALL',
  baseball_indoor:  'BASEBALL',
  baseball_out:     'BASEBALL_HOF',
  baseball_outdoor: 'BASEBALL_HOF',
  volleyball:       'VOLLEYBALL',
};

// ── 型定義 ────────────────────────────────────────────────────────────────
interface ImageEntry {
  url: string;
  s3Key: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface RequestEntry {
  index: number;
  text: string;
  status: string;
  date: string;
  isPriority: boolean;
  isWorking: boolean;
  isReviewed: boolean;
  images: ImageEntry[];
}

interface TeamEntry {
  wpPostId: string;
  teamName: string;
  sport: string;
  wpCreator: string;
  requests: RequestEntry[];
}

// ── XML ヘルパー ──────────────────────────────────────────────────────────
function extractCdata(text: string, fullTag: string): string {
  const open  = '<' + fullTag + '>' + CDATA_OPEN;
  const close = CDATA_CLOSE + '</' + fullTag + '>';
  const start = text.indexOf(open);
  if (start === -1) return '';
  const vs = start + open.length;
  const end = text.indexOf(close, vs);
  return end === -1 ? '' : text.slice(vs, end);
}

function extractTagValue(text: string, fullTag: string): string {
  const open  = '<' + fullTag + '>';
  const close = '</' + fullTag + '>';
  const start = text.indexOf(open);
  if (start === -1) return '';
  const vs  = start + open.length;
  const end = text.indexOf(close, vs);
  if (end === -1) return '';
  let val = text.slice(vs, end).trim();
  if (val.startsWith(CDATA_OPEN) && val.endsWith(CDATA_CLOSE)) {
    val = val.slice(CDATA_OPEN.length, val.length - CDATA_CLOSE.length);
  }
  return val;
}

function extractMeta(itemText: string, metaKey: string): string {
  const keyOpen = '<wp:meta_key>' + CDATA_OPEN + metaKey + CDATA_CLOSE + '</wp:meta_key>';
  const keyIdx  = itemText.indexOf(keyOpen);
  if (keyIdx === -1) return '';
  const valOpen  = '<wp:meta_value>' + CDATA_OPEN;
  const valStart = itemText.indexOf(valOpen, keyIdx + keyOpen.length);
  if (valStart === -1) return '';
  const cs  = valStart + valOpen.length;
  const ve  = itemText.indexOf(CDATA_CLOSE + '</wp:meta_value>', cs);
  return ve === -1 ? '' : itemText.slice(cs, ve);
}

function mapStatus(wpStatus: string): string {
  switch (wpStatus.trim()) {
    case '1': return 'COMPLETED';
    case '2': return 'IN_PROGRESS';
    default:  return 'PENDING';
  }
}

// ── 画像URLヘルパー ────────────────────────────────────────────────────────
function mimeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png',  gif: 'image/gif',
    webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
  };
  return map[ext] || 'image/jpeg';
}

function urlToImageEntry(raw: string): ImageEntry | null {
  const url = raw.trim();
  if (!url || !url.startsWith('http')) return null;
  let s3Key = url;
  if (url.startsWith(S3_PREFIX))  s3Key = url.slice(S3_PREFIX.length);
  else if (url.startsWith(WP_PREFIX)) s3Key = url.slice(WP_PREFIX.length);
  else { try { s3Key = new URL(url).pathname.slice(1); } catch { /* noop */ } }
  const filename = path.basename(decodeURIComponent(url.split('?')[0]));
  return { url, s3Key, filename, mimeType: mimeFromFilename(filename), size: 0 };
}

// ── CSV パーサー ──────────────────────────────────────────────────────────
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      i++;
      let field = '';
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { field += '"'; i += 2; }
        else if (line[i] === '"')                   { i++; break; }
        else                                         { field += line[i++]; }
      }
      fields.push(field);
      if (line[i] === ',') i++;
    } else {
      const end = line.indexOf(',', i);
      if (end === -1) { fields.push(line.slice(i)); break; }
      fields.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return fields;
}

/** CSV → Map<postId, {teamName, date, images}> (2026년 1월 이후만) */
function parseCsv(csvPath: string): Map<string, { teamName: string; date: string; images: ImageEntry[] }> {
  console.log('CSV 읽는 중...');
  const content = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
  const lines   = content.split(/\r?\n/);
  const result  = new Map<string, { teamName: string; date: string; images: ImageEntry[] }>();

  for (let li = 1; li < lines.length; li++) {
    const line = lines[li].trim();
    if (!line) continue;

    const f = parseCSVLine(line);
    const id       = f[0]?.trim();
    const title    = f[1]?.trim() || '';
    const date     = f[4]?.trim() || '';
    const postType = f[5]?.trim() || '';
    const imageUrl = f[7]?.trim() || '';   // Image URL (pipe-sep)
    const attachUrl= f[16]?.trim() || '';  // Attachment URL (pipe-sep)

    if (postType !== 'team') continue;
    // 2026년 1월 이후만
    if (!date.startsWith('2026-0') && !date.startsWith('2026-1')) continue;
    const dateNum = date.replace(/\D/g, '').slice(0, 6); // YYYYMM
    if (parseInt(dateNum, 10) < 202601) continue;
    if (!id) continue;

    const seen   = new Set<string>();
    const images: ImageEntry[] = [];

    const addUrl = (u: string) => {
      const trimmed = u.trim();
      if (!trimmed || seen.has(trimmed)) return;
      const entry = urlToImageEntry(trimmed);
      if (entry) { images.push(entry); seen.add(trimmed); }
    };

    if (imageUrl)  imageUrl.split('|').forEach(addUrl);
    if (attachUrl) attachUrl.split('|').forEach(addUrl);

    result.set(id, { teamName: title, date, images });
  }

  return result;
}

/** XML → Map<postId, {sport, wpCreator, requests}> (team 포스트 전체) */
function parseXmlMeta(xmlPath: string): Map<string, { sport: string; wpCreator: string; requests: RequestEntry[] }> {
  console.log('XML 읽는 중... (대용량 파일)');
  const raw    = fs.readFileSync(xmlPath, 'utf8');
  const blocks = raw.split('</item>').filter((b) => b.includes('<item>'));
  console.log(`  총 아이템: ${blocks.length}`);

  const result = new Map<string, { sport: string; wpCreator: string; requests: RequestEntry[] }>();

  for (const block of blocks) {
    const postType = extractCdata(block, 'wp:post_type');
    if (postType !== 'team') continue;

    const postStatus = extractCdata(block, 'wp:status');
    if (postStatus === 'trash') continue;

    const postId    = extractTagValue(block, 'wp:post_id');
    if (!postId) continue;

    const wpSport   = extractMeta(block, 'sport_category');
    const dbSport   = SPORT_MAP[wpSport] || 'UNKNOWN';
    const wpCreator = extractCdata(block, 'dc:creator');

    const requestCountStr = extractMeta(block, 'requests');
    const requestCount    = parseInt(requestCountStr, 10) || 0;

    const requests: RequestEntry[] = [];
    for (let i = 0; i < requestCount; i++) {
      const text       = extractMeta(block, `requests_${i}_request_text`).trim();
      const statusStr  = extractMeta(block, `requests_${i}_request_status`);
      const date       = extractMeta(block, `requests_${i}_request_date`).trim();
      const isPriority = extractMeta(block, `requests_${i}_is_priority`) === '1';
      const isWorking  = extractMeta(block, `requests_${i}_is_working`)  === '1';
      const isReviewed = extractMeta(block, `requests_${i}_is_reviewed`) === '1';
      requests.push({ index: i, text, status: mapStatus(statusStr), date, isPriority, isWorking, isReviewed, images: [] });
    }

    result.set(postId, { sport: dbSport, wpCreator, requests });
  }

  return result;
}

// ── メイン ───────────────────────────────────────────────────────────────
function main() {
  const csvPath  = process.argv[2] || path.resolve(__dirname, '../../..', '팀 Export 2026 April 14 0909.csv');
  const xmlPath  = process.argv[3] || path.resolve(__dirname, '../../..', 'designmax.WordPress.2026-04-09.xml');
  const outputDir = path.resolve(__dirname, '../..', 'data/wp');

  if (!fs.existsSync(csvPath)) { console.error('CSV 파일 없음:', csvPath); process.exit(1); }
  if (!fs.existsSync(xmlPath)) { console.error('XML 파일 없음:', xmlPath); process.exit(1); }
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const csvMap = parseCsv(csvPath);
  console.log(`CSV 2026년 팀: ${csvMap.size}개`);

  const xmlMap = parseXmlMeta(xmlPath);
  console.log(`XML team 포스트: ${xmlMap.size}개`);

  // ── 병합 ──
  const sportMap = new Map<string, TeamEntry[]>();
  let xmlMatchCount   = 0;
  let noXmlCount      = 0;

  for (const [postId, csv] of csvMap) {
    const xml    = xmlMap.get(postId);
    const sport  = xml?.sport || 'UNKNOWN';
    const creator = xml?.wpCreator || '';

    if (xml) xmlMatchCount++; else noXmlCount++;

    // requests 구성: XML 메타 + CSV 이미지 (req[0]에 배분)
    let requests: RequestEntry[];
    if (xml && xml.requests.length > 0) {
      // req[0]: XML 텍스트/상태/날짜 + CSV 이미지 전체
      requests = [
        { ...xml.requests[0], images: csv.images },
        ...xml.requests.slice(1),    // re-request들 (이미지 없음, 텍스트만)
      ];
    } else {
      // XML에 데이터 없음 → CSV만으로 req[0] 생성
      requests = [{
        index:      0,
        text:       '',
        status:     'PENDING',
        date:       csv.date,
        isPriority: false,
        isWorking:  false,
        isReviewed: false,
        images:     csv.images,
      }];
    }

    const team: TeamEntry = { wpPostId: postId, teamName: csv.teamName, sport, wpCreator: creator, requests };

    if (!sportMap.has(sport)) sportMap.set(sport, []);
    sportMap.get(sport)!.push(team);
  }

  console.log(`\n병합 결과: XML 매칭 ${xmlMatchCount}개, XML 없음(UNKNOWN) ${noXmlCount}개`);

  function split2026TeamsIntoThirds(teams: TeamEntry[]): [TeamEntry[], TeamEntry[], TeamEntry[]] {
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

  // ── 출력 ──
  for (const [sport, teams] of sportMap) {
    const [partA, partB, partC] = split2026TeamsIntoThirds(teams);
    const out1 = path.join(outputDir, `${sport}_2026.json`);
    const out2 = path.join(outputDir, `${sport}_2026b.json`);
    const out3 = path.join(outputDir, `${sport}_2026c.json`);
    fs.writeFileSync(out1, JSON.stringify({ sport, teams: partA }, null, 2), 'utf8');
    fs.writeFileSync(out2, JSON.stringify({ sport, teams: partB }, null, 2), 'utf8');
    fs.writeFileSync(out3, JSON.stringify({ sport, teams: partC }, null, 2), 'utf8');
    console.log(`✅ ${sport}_2026.json : ${partA.length}팀 (1/3) → ${out1}`);
    console.log(`✅ ${sport}_2026b.json : ${partB.length}팀 (2/3) → ${out2}`);
    console.log(`✅ ${sport}_2026c.json : ${partC.length}팀 (3/3) → ${out3}`);
  }

  console.log('\n완료! data/wp/ 에 {SPORT}_2026.json · _2026b.json · _2026c.json 이 생성되었습니다.');
  console.log('⚠️  UNKNOWN_2026.json 이 있다면 sport 값을 수동으로 지정해주세요.');
}

main();
