import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useAuthStore } from '@/stores/authStore';

// ── 오늘 날짜 기준 mock 통계 ────────────────────────────────
const TODAY = new Date('2026-04-28');
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'][TODAY.getDay()];
const DATE_LABEL = `${TODAY.getFullYear()}년 ${TODAY.getMonth() + 1}월 ${TODAY.getDate()}일 ${WEEKDAY}요일`;

const STAT_CARDS = [
  {
    label: '오늘 출근 인원',
    value: '7',
    sub: '/ 총 8명',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    bg: 'from-indigo-500 to-indigo-600',
    badge: '정상',
    badgeColor: 'bg-indigo-100 text-indigo-700',
  },
  {
    label: '지각 인원',
    value: '1',
    sub: '명',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    bg: 'from-amber-400 to-amber-500',
    badge: '박준혁',
    badgeColor: 'bg-amber-100 text-amber-700',
  },
  {
    label: '휴가 중',
    value: '1',
    sub: '명',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
      </svg>
    ),
    bg: 'from-emerald-400 to-emerald-500',
    badge: '윤채원 (연차)',
    badgeColor: 'bg-emerald-100 text-emerald-700',
  },
  {
    label: '승인 대기 휴가',
    value: '3',
    sub: '건',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    bg: 'from-rose-400 to-rose-500',
    badge: '처리 필요',
    badgeColor: 'bg-rose-100 text-rose-700',
  },
];

// ── 이번 달 근태 요약 차트 데이터 ──────────────────────────
const WORKDAYS_APRIL = [1,2,3,6,7,8,9,10,13,14,15,16,17,20,21,22,23,24,27,28];
const CHART_DATA = WORKDAYS_APRIL.map((d) => ({
  day: `${d}일`,
  출근: d <= 20 ? 7 : d === 21 ? 6 : d <= 24 ? 6 : d === 27 ? 7 : 7,
}));

// ── 사내 일정 ──────────────────────────────────────────────
const EVENTS = [
  { date: '5월 2~3일', label: '신입사원 온보딩', type: 'EVENT', color: 'bg-violet-100 text-violet-700' },
  { date: '5월 4일', label: '전사 월례 회의', type: 'MEETING', color: 'bg-indigo-100 text-indigo-700' },
  { date: '5월 15일', label: '직원 워크숍', type: 'EVENT', color: 'bg-teal-100 text-teal-700' },
  { date: '5월 20일', label: '개인정보 보호 교육', type: 'EDU', color: 'bg-amber-100 text-amber-700' },
];

// ── 최근 공지사항 ──────────────────────────────────────────
const NOTICES = [
  { id: 'ann-1', title: '2026년 5월 근무 일정 안내', date: '04.25', pinned: true },
  { id: 'ann-2', title: '직원 워크숍 안내 (5/15)', date: '04.22', pinned: false },
  { id: 'ann-3', title: '사무실 냉방기 점검 안내', date: '04.20', pinned: false },
  { id: 'ann-4', title: '4월 급여 지급 안내', date: '04.18', pinned: false },
];

// ── 알림 목록 ──────────────────────────────────────────────
const NOTIFICATIONS = [
  { id: 1, name: '박준혁', action: '연차 2일 승인됨', date: '04.28', status: 'approved' },
  { id: 2, name: '최지은', action: '반차(오전) 신청 대기', date: '04.25', status: 'pending' },
  { id: 3, name: '정민준', action: '병가 1일 신청 대기', date: '04.27', status: 'pending' },
  { id: 4, name: '황소연', action: '공가 2일 신청 대기', date: '04.27', status: 'pending' },
];

// ── 이번 달 근태 요약 테이블 ───────────────────────────────
const ATTENDANCE_SUMMARY = [
  { dept: '개발', total: 2, present: 2, late: 1, leave: 0 },
  { dept: '마케팅', total: 1, present: 1, late: 0, leave: 0 },
  { dept: '기획', total: 1, present: 0, late: 0, leave: 1 },
  { dept: 'CS', total: 1, present: 1, late: 0, leave: 0 },
  { dept: '디자인', total: 1, present: 1, late: 0, leave: 0 },
  { dept: '인사', total: 1, present: 1, late: 0, leave: 0 },
];

function StatCard({ card }: { card: typeof STAT_CARDS[0] }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-100 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{card.label}</p>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ${card.bg}`}>
          {card.icon}
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-4xl font-bold text-slate-900 leading-none">{card.value}</span>
        <span className="text-sm text-slate-400 mb-1">{card.sub}</span>
      </div>
      <span className={`self-start text-xs font-semibold px-2.5 py-1 rounded-full ${card.badgeColor}`}>
        {card.badge}
      </span>
      {/* decorative bg circle */}
      <div className={`absolute -right-4 -bottom-4 h-20 w-20 rounded-full bg-gradient-to-br opacity-[0.08] ${card.bg}`} />
    </div>
  );
}

const BAR_COLORS = CHART_DATA.map((d) =>
  d.출근 >= 7 ? '#6366f1' : d.출근 >= 6 ? '#a5b4fc' : '#e0e7ff'
);

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page header */}
      <div className="border-b border-slate-200 bg-white px-6 py-5 lg:px-8">
        <h1 className="text-xl font-bold text-slate-900">
          안녕하세요, {user?.name ?? '관리자'}님 👋
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">{DATE_LABEL} · HR 대시보드</p>
      </div>

      <div className="p-6 lg:p-8 space-y-6">
        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {STAT_CARDS.map((card) => <StatCard key={card.label} card={card} />)}
        </div>

        {/* ── Middle row: Chart + Events ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Attendance bar chart */}
          <div className="lg:col-span-3 rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-800">이번 달 출근 현황</h2>
                <p className="text-xs text-slate-400 mt-0.5">2026년 4월 · 일별 출근 인원</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-indigo-500" />전원 출근</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-indigo-300" />1명 부재</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={CHART_DATA} barSize={10} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                  interval={3} />
                <YAxis domain={[0, 8]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', fontSize: 12 }}
                  formatter={(v) => [`${v}명`, '출근']}
                />
                <Bar dataKey="출근" radius={[4, 4, 0, 0]}>
                  {CHART_DATA.map((_, i) => <Cell key={i} fill={BAR_COLORS[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Upcoming events */}
          <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-800">사내 일정 미리보기</h2>
              <Link to="/calendar" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                전체 보기 →
              </Link>
            </div>
            <ul className="space-y-2.5">
              {EVENTS.map((ev, i) => (
                <li key={i} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                  <span className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold ${ev.color}`}>
                    {ev.date}
                  </span>
                  <span className="text-sm font-medium text-slate-700 truncate">{ev.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Bottom row: 근태 요약 테이블 + 공지 + 알림 ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* 이번 달 근태 요약 */}
          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
            <h2 className="text-base font-semibold text-slate-800 mb-4">이번 달 근태 요약</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-2 text-left text-xs font-semibold text-slate-400">부서</th>
                    <th className="pb-2 text-center text-xs font-semibold text-slate-400">인원</th>
                    <th className="pb-2 text-center text-xs font-semibold text-slate-400">출근</th>
                    <th className="pb-2 text-center text-xs font-semibold text-slate-400">지각</th>
                    <th className="pb-2 text-center text-xs font-semibold text-slate-400">휴가</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {ATTENDANCE_SUMMARY.map((row) => (
                    <tr key={row.dept} className="hover:bg-slate-50/80">
                      <td className="py-2.5 text-sm font-medium text-slate-700">{row.dept}</td>
                      <td className="py-2.5 text-center text-slate-500">{row.total}</td>
                      <td className="py-2.5 text-center">
                        <span className="text-indigo-600 font-semibold">{row.present}</span>
                      </td>
                      <td className="py-2.5 text-center">
                        {row.late > 0
                          ? <span className="text-amber-600 font-semibold">{row.late}</span>
                          : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="py-2.5 text-center">
                        {row.leave > 0
                          ? <span className="text-emerald-600 font-semibold">{row.leave}</span>
                          : <span className="text-slate-300">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 최근 공지사항 */}
          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-800">최근 공지사항</h2>
              <Link to="/announcements" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                전체 보기 →
              </Link>
            </div>
            <ul className="space-y-3">
              {NOTICES.map((n) => (
                <li key={n.id}>
                  <Link
                    to={`/announcements/${n.id}`}
                    className="flex items-start gap-2.5 rounded-xl p-2.5 hover:bg-slate-50 transition-colors"
                  >
                    {n.pinned && (
                      <span className="mt-0.5 shrink-0 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600">
                        고정
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-700 truncate">{n.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{n.date}</p>
                    </div>
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 알림 목록 */}
          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-800">휴가 알림</h2>
              <Link to="/notifications" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                전체 보기 →
              </Link>
            </div>
            <ul className="space-y-3">
              {NOTIFICATIONS.map((n) => (
                <li key={n.id} className="flex items-start gap-3 rounded-xl p-2.5 hover:bg-slate-50 transition-colors">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                    {(n?.name ?? '?').charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700">
                      <span className="font-semibold">{n?.name ?? '—'}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{n.action}</p>
                  </div>
                  <span className={`shrink-0 self-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    n.status === 'approved'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}>
                    {n.status === 'approved' ? '승인' : '대기'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
