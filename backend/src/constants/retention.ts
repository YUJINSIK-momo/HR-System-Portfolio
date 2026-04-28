/** 채팅·디자인 요청 등 1년 보존 정책 (밀리초) — chatRetention.service 와 동일 기준 */
export const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** 팀 디자인 대시보드 `from`~`to` (일 시작~일 끝) 조회 시 최대 구간(윤년·월말 포함 여유) */
export const DESIGN_DASHBOARD_MAX_RANGE_MS = 366 * DAY_MS;
