/**
 * 공공데이터 API 디버그 스크립트
 * 실행: npx ts-node scripts/test-holiday-api.ts
 */
import 'dotenv/config';
import { XMLParser } from 'fast-xml-parser';

const BASE_URL = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService';

async function main() {
  const key = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!key) {
    console.error('DATA_GO_KR_SERVICE_KEY가 .env에 없습니다.');
    process.exit(1);
  }

  const url = new URL(`${BASE_URL}/getRestDeInfo`);
  url.searchParams.set('serviceKey', key);
  url.searchParams.set('solYear', '2025');
  url.searchParams.set('solMonth', '05');
  url.searchParams.set('numOfRows', '100');
  url.searchParams.set('pageNo', '1');

  console.log('요청 URL:', url.toString().replace(key, '***'));
  const res = await fetch(url.toString());
  const text = await res.text();
  console.log('\n=== HTTP 상태:', res.status);
  console.log('=== 응답 (처음 1500자):\n', text.slice(0, 1500));

  const parser = new XMLParser({ ignoreAttributes: true });
  const parsed = parser.parse(text) as any;
  const resultCode = parsed?.response?.header?.resultCode;
  const resultMsg = parsed?.response?.header?.resultMsg;
  console.log('\n=== resultCode:', resultCode, 'resultMsg:', resultMsg);

  const items = parsed?.response?.body?.items?.item;
  console.log('=== items 존재:', !!items);
  console.log('=== items 타입:', typeof items);
  if (items) {
    const arr = Array.isArray(items) ? items : [items];
    console.log('=== 파싱된 건수:', arr.length);
    arr.forEach((item: any, i: number) => {
      console.log(`  [${i}]`, JSON.stringify(item, null, 2).slice(0, 300));
    });
  }
}

main().catch(console.error);
