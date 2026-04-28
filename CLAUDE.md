# CLAUDE.md

## Project Goal
이 프로젝트는 포트폴리오용 HR 관리 대시보드이다.
기존 기능 중 아래 메뉴만 유지하고, 나머지 기능/페이지/라우트/컴포넌트는 삭제하거나 비활성화한다.

## Repository
GitHub Repository:
https://github.com/YUJINSIK-momo/HR-System-Portfolio.git

## Tech Stack
- Frontend: React
- Backend: Node.js + Express
- Database: Supabase PostgreSQL
- Deployment: GitHub Pages for frontend portfolio demo
- UI: Tailwind CSS + shadcn/ui style preferred

## Keep Only These Menus

### Main Dashboard
- 대시보드

### HR
- 근태 관리
- 연차 관리
- 사내 캘린더

### AI
- GEMINI

### Communication
- 공지사항
- 스케줄 관리
- 알림

### Admin
- 직원 관리
- 근태 현황
- 휴가 신청 관리

## Remove
아래 조건에 해당하는 것은 모두 삭제한다.

- 위 메뉴에 없는 모든 사이드바 메뉴
- 사용하지 않는 라우트
- 사용하지 않는 페이지
- 사용하지 않는 더미 컴포넌트
- 불필요한 테스트 페이지
- 포트폴리오 목적에 맞지 않는 내부 기능
- 미완성 CRM 메뉴

## Portfolio UI/UX Direction
전체 UI는 포트폴리오 제출용으로 세련되게 정리한다.

### Design Concept
- Modern SaaS HR Dashboard
- Clean Admin Panel
- Korean business dashboard style
- 밝고 깔끔한 톤
- 카드형 레이아웃
- 통계 위젯
- 사이드바 + 상단 헤더 구조

### Layout
- Left Sidebar
- Top Header
- Main Content Area
- Responsive layout
- Desktop 우선, 모바일 기본 대응

### Dashboard Page
대시보드에는 아래 카드들을 배치한다.

- 오늘 출근 인원
- 지각 인원
- 휴가 사용 인원
- 승인 대기 휴가
- 이번 달 근태 요약
- 사내 일정 미리보기
- 최근 공지사항
- 알림 목록

### UI Requirements
- 메뉴 아이콘 추가
- Active 메뉴 상태 표시
- hover 효과 추가
- 카드 shadow / rounded 적용
- 통계 카드는 숫자가 크게 보이도록 구성
- 빈 화면 없이 모든 페이지에 포트폴리오용 mock data 표시
- 전체적으로 “실제로 운영 가능한 사내 HR 시스템”처럼 보이게 구성

## Login Requirement

슈퍼어드민 로그인 화면을 만든다.

### Demo Login Account
포트폴리오 시연용으로 로그인 화면에 아래 계정을 명확히 표시한다.

ID:
admin@jinsik.com

Password:
jinsik2036

### Login UI
로그인 화면에는 다음을 포함한다.

- 서비스명: HR System Portfolio
- 설명: 사내 근태/연차/일정 관리 대시보드
- 이메일 입력
- 비밀번호 입력
- 로그인 버튼
- Demo Account 박스

Demo Account 박스 예시:

관리자 데모 계정
ID: admin@jinsik.com
PW: jinsik2036

주의:
포트폴리오용이므로 프론트에 계정을 표시해도 된다.
다만 실제 운영 서비스에서는 절대 이렇게 구현하지 않는다.

## Auth Logic
포트폴리오 데모용 간단 로그인 처리만 구현한다.

조건:
- email === "admin@jinsik.com"
- password === "jinsik2036"

성공 시:
- dashboard로 이동
- localStorage에 demo auth 상태 저장

실패 시:
- 에러 메시지 표시

## Supabase
DB는 Supabase를 사용한다.

초기에는 포트폴리오 속도를 위해 mock data 중심으로 구현해도 된다.
단, Supabase 연동 구조는 유지한다.

필요한 env:

VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

주의:
- Supabase service role key는 절대 프론트에 넣지 않는다.
- Supabase 테이블에는 RLS 활성화를 전제로 설계한다.
- 실제 운영용 개인정보는 넣지 않는다.

## Suggested Supabase Tables

### employees
- id
- name
- email
- department
- position
- status
- joined_at
- created_at

### attendance_records
- id
- employee_id
- date
- check_in
- check_out
- status
- created_at

### leave_requests
- id
- employee_id
- leave_type
- start_date
- end_date
- reason
- status
- created_at

### notices
- id
- title
- content
- pinned
- created_at

### schedules
- id
- title
- start_date
- end_date
- type
- created_at

### notifications
- id
- title
- message
- read
- created_at

## Deployment
Frontend는 GitHub Pages로 배포한다.

Vite 사용 시 `vite.config.ts`에 base 설정을 추가한다.

```ts
export default defineConfig({
  base: "/HR-System-Portfolio/",
  plugins: [react()],
})