// Portfolio demo mock data — generated for 2026-04-28 as "today"

export const DEMO_USER_ID = 'emp-1';

export const MOCK_EMPLOYEES = [
  { id: 'emp-1', email: 'admin@jinsik.com', role: 'SUPER_ADMIN', status: 'ACTIVE',
    profile: { name: '김진식', department: '경영', position: '대표이사', phone: '010-1234-5678', hireDate: '2020-01-02', useJapanese: false },
    leaveBalances: [{ year: 2026, totalDays: 15, usedDays: 3 }] },
  { id: 'emp-2', email: 'soomin@company.com', role: 'MANAGER', status: 'ACTIVE',
    profile: { name: '이수민', department: '인사', position: '인사팀장', phone: '010-2345-6789', hireDate: '2021-03-15', useJapanese: false },
    leaveBalances: [{ year: 2026, totalDays: 15, usedDays: 5 }] },
  { id: 'emp-3', email: 'junhyuk@company.com', role: 'EMPLOYEE', status: 'ACTIVE',
    profile: { name: '박준혁', department: '개발', position: '시니어 개발자', phone: '010-3456-7890', hireDate: '2021-07-01', useJapanese: false },
    leaveBalances: [{ year: 2026, totalDays: 15, usedDays: 2 }] },
  { id: 'emp-4', email: 'jieun@company.com', role: 'EMPLOYEE', status: 'ACTIVE',
    profile: { name: '최지은', department: '개발', position: '개발자', phone: '010-4567-8901', hireDate: '2022-01-10', useJapanese: false },
    leaveBalances: [{ year: 2026, totalDays: 15, usedDays: 1 }] },
  { id: 'emp-5', email: 'minjun@company.com', role: 'EMPLOYEE', status: 'ACTIVE',
    profile: { name: '정민준', department: '마케팅', position: '마케터', phone: '010-5678-9012', hireDate: '2022-06-01', useJapanese: false },
    leaveBalances: [{ year: 2026, totalDays: 15, usedDays: 0 }] },
  { id: 'emp-6', email: 'soyeon@company.com', role: 'CS', status: 'ACTIVE',
    profile: { name: '황소연', department: 'CS', position: 'CS 담당', phone: '010-6789-0123', hireDate: '2023-02-01', useJapanese: false },
    leaveBalances: [{ year: 2026, totalDays: 11, usedDays: 0 }] },
  { id: 'emp-7', email: 'taeyang@company.com', role: 'EMPLOYEE', status: 'ACTIVE',
    profile: { name: '강태양', department: '디자인', position: '디자이너', phone: '010-7890-1234', hireDate: '2023-05-15', useJapanese: false },
    leaveBalances: [{ year: 2026, totalDays: 11, usedDays: 0 }] },
  { id: 'emp-8', email: 'chaewon@company.com', role: 'EMPLOYEE', status: 'ACTIVE',
    profile: { name: '윤채원', department: '기획', position: '기획자', phone: '010-8901-2345', hireDate: '2024-01-02', useJapanese: false },
    leaveBalances: [{ year: 2026, totalDays: 11, usedDays: 6 }] },
];

export const MOCK_LEAVE_REQUESTS_ADMIN = [
  { id: 'lr-1', user: { id: 'emp-3', email: 'junhyuk@company.com', profile: { name: '박준혁' } },
    type: 'ANNUAL', startDate: '2026-04-28T00:00:00.000Z', endDate: '2026-04-29T00:00:00.000Z', days: 2,
    status: 'APPROVED', reason: '개인 사정', createdAt: '2026-04-20T09:00:00.000Z' },
  { id: 'lr-2', user: { id: 'emp-4', email: 'jieun@company.com', profile: { name: '최지은' } },
    type: 'HALF_DAY_AM', startDate: '2026-04-30T00:00:00.000Z', endDate: '2026-04-30T00:00:00.000Z', days: 0.5,
    status: 'PENDING', reason: '병원 방문', createdAt: '2026-04-25T10:00:00.000Z' },
  { id: 'lr-3', user: { id: 'emp-8', email: 'chaewon@company.com', profile: { name: '윤채원' } },
    type: 'ANNUAL', startDate: '2026-04-21T00:00:00.000Z', endDate: '2026-04-28T00:00:00.000Z', days: 6,
    status: 'APPROVED', reason: '연차 소진', createdAt: '2026-04-15T09:00:00.000Z' },
  { id: 'lr-4', user: { id: 'emp-5', email: 'minjun@company.com', profile: { name: '정민준' } },
    type: 'SICK', startDate: '2026-05-02T00:00:00.000Z', endDate: '2026-05-02T00:00:00.000Z', days: 1,
    status: 'PENDING', reason: '감기', createdAt: '2026-04-27T14:00:00.000Z' },
  { id: 'lr-5', user: { id: 'emp-2', email: 'soomin@company.com', profile: { name: '이수민' } },
    type: 'ANNUAL', startDate: '2026-05-05T00:00:00.000Z', endDate: '2026-05-07T00:00:00.000Z', days: 3,
    status: 'APPROVED', reason: '가족 행사', createdAt: '2026-04-22T11:00:00.000Z' },
  { id: 'lr-6', user: { id: 'emp-1', email: 'admin@jinsik.com', profile: { name: '김진식' } },
    type: 'ANNUAL', startDate: '2026-03-10T00:00:00.000Z', endDate: '2026-03-12T00:00:00.000Z', days: 3,
    status: 'APPROVED', reason: '연차', createdAt: '2026-03-05T09:00:00.000Z' },
  { id: 'lr-7', user: { id: 'emp-7', email: 'taeyang@company.com', profile: { name: '강태양' } },
    type: 'HALF_DAY_PM', startDate: '2026-04-17T00:00:00.000Z', endDate: '2026-04-17T00:00:00.000Z', days: 0.5,
    status: 'REJECTED', reason: '개인 일정', createdAt: '2026-04-16T08:00:00.000Z' },
  { id: 'lr-8', user: { id: 'emp-6', email: 'soyeon@company.com', profile: { name: '황소연' } },
    type: 'OFFICIAL', startDate: '2026-05-12T00:00:00.000Z', endDate: '2026-05-13T00:00:00.000Z', days: 2,
    status: 'PENDING', reason: '외부 교육 참석', createdAt: '2026-04-27T16:00:00.000Z' },
];

// My leave requests (demo admin's own)
export const MOCK_MY_LEAVE_REQUESTS = [
  { id: 'lr-6', type: 'ANNUAL', startDate: '2026-03-10T00:00:00.000Z', endDate: '2026-03-12T00:00:00.000Z', days: 3,
    status: 'APPROVED', reason: '연차', familySubType: null, createdAt: '2026-03-05T09:00:00.000Z' },
  { id: 'lr-me-1', type: 'ANNUAL', startDate: '2026-06-02T00:00:00.000Z', endDate: '2026-06-03T00:00:00.000Z', days: 2,
    status: 'APPROVED', reason: '여름 휴가 준비', familySubType: null, createdAt: '2026-05-20T09:00:00.000Z' },
];

/** 백엔드 형태와 동일하게 id·policy 포함 (직접 URL 렌더 시에도 카드 헤더가 안전) */
export const MOCK_LEAVE_BALANCE = [
  {
    id: 'lb-demo-2026',
    year: 2026,
    totalDays: 15,
    usedDays: 3,
    policy: { name: '연차' },
  },
];

export const MOCK_LEAVE_NOTIFICATIONS = [
  { id: 'ln-1', type: 'ANNUAL', startDate: '2026-04-28T00:00:00.000Z', endDate: '2026-04-29T00:00:00.000Z',
    days: 2, status: 'APPROVED', employeeName: '박준혁', familySubType: null, createdAt: '2026-04-20T09:00:00.000Z' },
  { id: 'ln-2', type: 'HALF_DAY_AM', startDate: '2026-04-30T00:00:00.000Z', endDate: '2026-04-30T00:00:00.000Z',
    days: 0.5, status: 'PENDING', employeeName: '최지은', familySubType: null, createdAt: '2026-04-25T10:00:00.000Z' },
  { id: 'ln-3', type: 'SICK', startDate: '2026-05-02T00:00:00.000Z', endDate: '2026-05-02T00:00:00.000Z',
    days: 1, status: 'PENDING', employeeName: '정민준', familySubType: null, createdAt: '2026-04-27T14:00:00.000Z' },
  { id: 'ln-4', type: 'OFFICIAL', startDate: '2026-05-12T00:00:00.000Z', endDate: '2026-05-13T00:00:00.000Z',
    days: 2, status: 'PENDING', employeeName: '황소연', familySubType: null, createdAt: '2026-04-27T16:00:00.000Z' },
];

// Today's check-in for demo user
export const MOCK_ATTENDANCE_TODAY = {
  id: 'att-today-1',
  userId: DEMO_USER_ID,
  date: '2026-04-28T00:00:00.000Z',
  checkIn: '2026-04-28T00:01:00.000Z',  // 09:01 KST
  checkOut: null,
  status: 'NORMAL',
  workLocation: 'OFFICE',
};

// Generate attendance history for demo user (self)
function getWorkDays(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const today = new Date('2026-04-28T00:00:00');
  const cur = new Date(start);
  while (cur <= end && cur <= today) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push(cur.toISOString().slice(0, 10));
    }
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

const CHECKIN_TIMES: Record<string, string> = {
  'emp-1': '00:01', 'emp-2': '00:05', 'emp-3': '00:15', 'emp-4': '23:55',
  'emp-5': '00:00', 'emp-6': '00:02', 'emp-7': '00:08', 'emp-8': '00:00',
};
const LATE_IDS = new Set(['emp-3']);
const LEAVE_DAYS_EMP8 = new Set(['2026-04-21','2026-04-22','2026-04-23','2026-04-24','2026-04-25','2026-04-27','2026-04-28']);

export function generateAdminAttendance(startDate: string, endDate: string) {
  const days = getWorkDays(startDate, endDate);
  const records: any[] = [];
  let idCounter = 1;

  for (const day of days) {
    for (const emp of MOCK_EMPLOYEES) {
      if (emp.id === 'emp-8' && LEAVE_DAYS_EMP8.has(day)) {
        records.push({
          id: `att-${idCounter++}`,
          userId: emp.id,
          date: `${day}T00:00:00.000Z`,
          checkIn: null,
          checkOut: null,
          status: 'ON_LEAVE',
          workLocation: null,
          user: { profile: { name: emp.profile.name }, email: emp.email },
        });
        continue;
      }
      const ciOffset = CHECKIN_TIMES[emp.id] || '00:00';
      // Use Seoul time offset: 09:01 KST = 00:01 UTC
      const checkInUTC = `${day}T${ciOffset}:00.000Z`;
      const checkOutUTC = day === '2026-04-28' ? null : `${day}T09:00:00.000Z`;
      const isLate = LATE_IDS.has(emp.id);
      records.push({
        id: `att-${idCounter++}`,
        userId: emp.id,
        date: `${day}T00:00:00.000Z`,
        checkIn: checkInUTC,
        checkOut: checkOutUTC,
        status: isLate ? 'LATE' : 'NORMAL',
        workLocation: 'OFFICE',
        user: { profile: { name: emp.profile.name }, email: emp.email },
      });
    }
  }
  return records;
}

export function generateMyAttendanceHistory(startDate: string, endDate: string) {
  const days = getWorkDays(startDate, endDate);
  return days.map((day, i) => ({
    id: `my-att-${i + 1}`,
    userId: DEMO_USER_ID,
    date: `${day}T00:00:00.000Z`,
    checkIn: `${day}T00:01:00.000Z`,
    checkOut: day === '2026-04-28' ? null : `${day}T09:00:00.000Z`,
    status: 'NORMAL',
    workLocation: 'OFFICE',
  }));
}

export const MOCK_ANNOUNCEMENTS = [
  { id: 'ann-1', title: '2026년 5월 근무 일정 안내', pinned: true,
    content: '안녕하세요. 5월 근무 일정을 안내드립니다.\n\n• 5월 1일 (금) 노동절 — 법정 공휴일\n• 5월 5일 (화) 어린이날 — 법정 공휴일\n• 5월 15일 (금) 사내 워크숍 (오후 2시~)\n\n근무 관련 문의사항은 인사팀으로 연락 주시기 바랍니다.',
    imageS3Keys: [], reactions: [], comments: [], createdAt: '2026-04-25T09:00:00.000Z' },
  { id: 'ann-2', title: '직원 워크숍 안내 (5/15)', pinned: false,
    content: '전 직원 대상 워크숍을 안내드립니다.\n\n• 일시: 2026년 5월 15일 (금) 오후 2시\n• 장소: 회의실 A동 3층\n• 주제: 하반기 OKR 리뷰 및 팀 빌딩\n\n참석이 어려운 분은 사전에 팀장에게 알려 주시기 바랍니다.',
    imageS3Keys: [], reactions: [], comments: [], createdAt: '2026-04-22T14:00:00.000Z' },
  { id: 'ann-3', title: '사무실 냉방기 점검 안내', pinned: false,
    content: '안녕하세요. 총무팀입니다.\n\n하절기를 대비하여 4월 30일(목) 오전 10시~12시 사무실 냉방기 점검이 진행됩니다.\n점검 시간 동안 냉방 사용이 일시 중단될 수 있으니 양해 부탁드립니다.',
    imageS3Keys: [], reactions: [], comments: [], createdAt: '2026-04-20T10:00:00.000Z' },
  { id: 'ann-4', title: '4월 급여 지급 안내', pinned: false,
    content: '2026년 4월 급여는 4월 25일(토) 지급 예정입니다.\n토요일인 관계로 4월 24일(금) 선지급될 예정입니다.\n문의사항은 경리팀(내선 102)으로 연락 주시기 바랍니다.',
    imageS3Keys: [], reactions: [], comments: [], createdAt: '2026-04-18T09:00:00.000Z' },
  { id: 'ann-5', title: '사내 도서관 서비스 오픈', pinned: false,
    content: '사내 도서관 서비스가 오픈되었습니다.\n\n• 위치: 3층 라운지\n• 이용 가능 시간: 평일 09:00~18:00\n• 도서 대출: 1인당 최대 3권, 대출 기간 2주\n\n많은 이용 부탁드립니다.',
    imageS3Keys: [], reactions: [], comments: [], createdAt: '2026-04-15T11:00:00.000Z' },
  { id: 'ann-6', title: '개인정보 보호 교육 안내', pinned: false,
    content: '연 1회 의무 개인정보 보호 교육 일정을 안내드립니다.\n\n• 일시: 2026년 5월 20일(수) 오후 3시\n• 방식: 온라인 (링크 추후 공유)\n• 이수 마감: 5월 31일\n\n미이수 시 불이익이 있을 수 있습니다.',
    imageS3Keys: [], reactions: [], comments: [], createdAt: '2026-04-10T09:00:00.000Z' },
];

export const MOCK_CALENDAR_EVENTS = [
  { id: 'ce-1', title: '전사 월례 회의', description: '4월 실적 리뷰 및 5월 목표 설정', startDate: '2026-05-04', endDate: '2026-05-04', createdAt: '2026-04-20T09:00:00.000Z' },
  { id: 'ce-2', title: '직원 워크숍', description: '하반기 OKR 리뷰 및 팀 빌딩', startDate: '2026-05-15', endDate: '2026-05-15', createdAt: '2026-04-22T10:00:00.000Z' },
  { id: 'ce-3', title: 'Q2 OKR 리뷰', description: '2분기 목표 달성 현황 점검', startDate: '2026-06-01', endDate: '2026-06-01', createdAt: '2026-04-01T09:00:00.000Z' },
  { id: 'ce-4', title: '신입사원 온보딩', description: '5월 신입사원 입사 교육', startDate: '2026-05-02', endDate: '2026-05-03', createdAt: '2026-04-15T09:00:00.000Z' },
  { id: 'ce-5', title: '냉방기 점검', description: '전사 냉방기 일괄 점검', startDate: '2026-04-30', endDate: '2026-04-30', createdAt: '2026-04-18T14:00:00.000Z' },
  { id: 'ce-6', title: '개인정보 보호 교육', description: '연 1회 의무 교육', startDate: '2026-05-20', endDate: '2026-05-20', createdAt: '2026-04-10T09:00:00.000Z' },
];

export const MOCK_HOLIDAYS = [
  { id: 'h-1', date: '2026-01-01', name: '신정' },
  { id: 'h-2', date: '2026-01-28', name: '설날 연휴' },
  { id: 'h-3', date: '2026-01-29', name: '설날' },
  { id: 'h-4', date: '2026-01-30', name: '설날 연휴' },
  { id: 'h-5', date: '2026-03-01', name: '삼일절' },
  { id: 'h-6', date: '2026-05-01', name: '근로자의 날' },
  { id: 'h-7', date: '2026-05-05', name: '어린이날' },
  { id: 'h-8', date: '2026-05-24', name: '부처님오신날' },
  { id: 'h-9', date: '2026-06-06', name: '현충일' },
  { id: 'h-10', date: '2026-08-15', name: '광복절' },
  { id: 'h-11', date: '2026-09-24', name: '추석 연휴' },
  { id: 'h-12', date: '2026-09-25', name: '추석' },
  { id: 'h-13', date: '2026-09-26', name: '추석 연휴' },
  { id: 'h-14', date: '2026-10-03', name: '개천절' },
  { id: 'h-15', date: '2026-10-09', name: '한글날' },
  { id: 'h-16', date: '2026-12-25', name: '크리스마스' },
];

// Calendar leaves: { "2026-04-28": [{ name, type }], ... }
export function generateCalendarLeaves(start: string, end: string) {
  const result: Record<string, any[]> = {};
  const addLeave = (dateStr: string, name: string, type: string) => {
    if (dateStr >= start && dateStr <= end) {
      if (!result[dateStr]) result[dateStr] = [];
      result[dateStr].push({ name, type, id: `cl-${dateStr}-${name}` });
    }
  };
  // 박준혁 annual Apr 28-29
  addLeave('2026-04-28', '박준혁', 'ANNUAL');
  addLeave('2026-04-29', '박준혁', 'ANNUAL');
  // 윤채원 annual Apr 21-28
  ['2026-04-21','2026-04-22','2026-04-23','2026-04-24','2026-04-25','2026-04-27','2026-04-28'].forEach(d => addLeave(d, '윤채원', 'ANNUAL'));
  // 최지은 half-day Apr 30
  addLeave('2026-04-30', '최지은', 'HALF_DAY_AM');
  // 이수민 annual May 5-7
  ['2026-05-05','2026-05-06','2026-05-07'].forEach(d => addLeave(d, '이수민', 'ANNUAL'));
  return result;
}

export const MOCK_SCHEDULE_PROJECTS = [
  {
    id: 'p-1', name: '웹사이트 리뉴얼', description: '회사 메인 홈페이지 전면 리뉴얼', color: '#6366f1', year: 2026,
    tasks: [
      { id: 't-1', title: '메인 페이지 디자인 확정', projectId: 'p-1', projectName: '웹사이트 리뉴얼', projectColor: '#6366f1',
        status: 'IN_PROGRESS', priority: 'HIGH', startDate: '2026-04-21', endDate: '2026-04-30', dueDate: null,
        description: '', assigneeId: 'emp-1', assigneeIds: ['emp-1', 'emp-7'],
        assignees: [{ id: 'emp-1', name: '김진식' }, { id: 'emp-7', name: '강태양' }] },
      { id: 't-2', title: '모바일 반응형 구현', projectId: 'p-1', projectName: '웹사이트 리뉴얼', projectColor: '#6366f1',
        status: 'TODO', priority: 'MEDIUM', startDate: '2026-05-01', endDate: '2026-05-20', dueDate: null,
        description: '', assigneeId: 'emp-3', assigneeIds: ['emp-3', 'emp-4'],
        assignees: [{ id: 'emp-3', name: '박준혁' }, { id: 'emp-4', name: '최지은' }] },
      { id: 't-3', title: 'SEO 최적화', projectId: 'p-1', projectName: '웹사이트 리뉴얼', projectColor: '#6366f1',
        status: 'TODO', priority: 'LOW', startDate: '2026-05-21', endDate: '2026-05-31', dueDate: null,
        description: '', assigneeId: 'emp-5', assigneeIds: ['emp-5'],
        assignees: [{ id: 'emp-5', name: '정민준' }] },
    ],
  },
  {
    id: 'p-2', name: 'HR 시스템 고도화', description: '근태/연차 관리 기능 개선', color: '#10b981', year: 2026,
    tasks: [
      { id: 't-4', title: '근태 API 개선', projectId: 'p-2', projectName: 'HR 시스템 고도화', projectColor: '#10b981',
        status: 'TODO', priority: 'HIGH', startDate: '2026-05-01', endDate: '2026-05-15', dueDate: null,
        description: '', assigneeId: 'emp-1', assigneeIds: ['emp-1', 'emp-3'],
        assignees: [{ id: 'emp-1', name: '김진식' }, { id: 'emp-3', name: '박준혁' }] },
      { id: 't-5', title: '연차 신청 UX 개선', projectId: 'p-2', projectName: 'HR 시스템 고도화', projectColor: '#10b981',
        status: 'IN_PROGRESS', priority: 'MEDIUM', startDate: '2026-04-15', endDate: '2026-04-30', dueDate: null,
        description: '', assigneeId: 'emp-4', assigneeIds: ['emp-4'],
        assignees: [{ id: 'emp-4', name: '최지은' }] },
    ],
  },
  {
    id: 'p-3', name: '마케팅 캠페인 Q2', description: '2분기 온라인 마케팅 캠페인', color: '#f59e0b', year: 2026,
    tasks: [
      { id: 't-6', title: 'SNS 콘텐츠 기획', projectId: 'p-3', projectName: '마케팅 캠페인 Q2', projectColor: '#f59e0b',
        status: 'DONE', priority: 'HIGH', startDate: '2026-04-01', endDate: '2026-04-20', dueDate: null,
        description: '', assigneeId: 'emp-5', assigneeIds: ['emp-5'],
        assignees: [{ id: 'emp-5', name: '정민준' }] },
      { id: 't-7', title: '광고 소재 제작', projectId: 'p-3', projectName: '마케팅 캠페인 Q2', projectColor: '#f59e0b',
        status: 'DONE', priority: 'MEDIUM', startDate: '2026-04-10', endDate: '2026-04-25', dueDate: null,
        description: '', assigneeId: 'emp-7', assigneeIds: ['emp-5', 'emp-7'],
        assignees: [{ id: 'emp-5', name: '정민준' }, { id: 'emp-7', name: '강태양' }] },
    ],
  },
];

export const MOCK_PERSONAL_TODOS = [
  { id: 'todo-1', title: '주간 보고서 작성', done: false },
  { id: 'todo-2', title: '팀장 면담 준비', done: false },
  { id: 'todo-3', title: '5월 팀 일정 조율', done: true },
];

export const MOCK_ASSIGNABLE_USERS = MOCK_EMPLOYEES.map(e => ({
  id: e.id,
  email: e.email,
  name: e.profile.name,
  profile: { name: e.profile.name },
}));

export const MOCK_APPROVED_FOR_SCHEDULE = [
  { id: 'lr-1', type: 'ANNUAL', startDate: '2026-04-28', endDate: '2026-04-29', user: { name: '박준혁' } },
  { id: 'lr-3', type: 'ANNUAL', startDate: '2026-04-21', endDate: '2026-04-28', user: { name: '윤채원' } },
  { id: 'lr-5', type: 'ANNUAL', startDate: '2026-05-05', endDate: '2026-05-07', user: { name: '이수민' } },
];

export const MOCK_MEMO_REMINDERS = [
  { id: 'mr-1', title: '이사회 자료 준비', remindAt: '2026-04-29T01:00:00.000Z', createdAt: '2026-04-25T09:00:00.000Z' },
];

export const MOCK_AUTH_ME = {
  id: DEMO_USER_ID,
  email: 'admin@jinsik.com',
  name: '김진식',
  role: 'SUPER_ADMIN',
  preferredLanguage: 'ko',
  position: '대표이사',
  chatTranslationMode: 'none',
  avatarS3Key: null,
};

export const MOCK_ATTENDANCE_CORRECTIONS_ME: any[] = [];
export const MOCK_ATTENDANCE_CORRECTIONS_ADMIN: any[] = [];
