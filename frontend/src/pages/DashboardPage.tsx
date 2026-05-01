import { Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useAuthStore } from '@/stores/authStore';

const TODAY = new Date('2026-04-28');
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'][TODAY.getDay()];
const DATE_LABEL = `${TODAY.getFullYear()}년 ${TODAY.getMonth() + 1}월 ${TODAY.getDate()}일 ${WEEKDAY}요일`;

const STAT_CARDS = [
  {
    label: '오늘 출근 인원',
    value: '7',
    sub: '/ 8명',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    gradient: 'from-indigo-500 to-indigo-700',
    shadow: 'shadow-indigo-300',
    badge: '정상 출근',
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
    gradient: 'from-amber-400 to-orange-500',
    shadow: 'shadow-amber-300',
    badge: '박준혁',
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
    gradient: 'from-emerald-400 to-teal-600',
    shadow: 'shadow-emerald-300',
    badge: '윤채원 (연차)',
  },
  {
    label: '승인 대기',
    value: '3',
    sub: '건',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    gradient: 'from-rose-400 to-pink-600',
    shadow: 'shadow-rose-300',
    badge: '처리 필요',
  },
];

// 주차별 출근률 (4월 기준)
const WEEKLY_DATA = [
  { week: '1주차', rate: 94 },
  { week: '2주차', rate: 91 },
  { week: '3주차', rate: 84 },
  { week: '4주차', rate: 78 },
  { week: '이번주', rate: 87 },
];

const EVENTS = [
  { date: '5월 2~3일', label: '신입사원 온보딩', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { date: '5월 4일', label: '전사 월례 회의', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { date: '5월 15일', label: '직원 워크숍', color: 'bg-teal-100 text-teal-700 border-teal-200' },
  { date: '5월 20일', label: '개인정보 보호 교육', color: 'bg-amber-100 text-amber-700 border-amber-200' },
];

const NOTICES = [
  { id: 'ann-1', title: '2026년 5월 근무 일정 안내', date: '04.25', pinned: true },
  { id: 'ann-2', title: '직원 워크숍 안내 (5/15)', date: '04.22', pinned: false },
  { id: 'ann-3', title: '사무실 냉방기 점검 안내', date: '04.20', pinned: false },
  { id: 'ann-4', title: '4월 급여 지급 안내', date: '04.18', pinned: false },
];

const NOTIFICATIONS = [
  { id: 1, name: '박준혁', action: '연차 2일 승인됨', date: '04.28', status: 'approved' },
  { id: 2, name: '최지은', action: '반차(오전) 신청 대기', date: '04.25', status: 'pending' },
  { id: 3, name: '정민준', action: '병가 1일 신청 대기', date: '04.27', status: 'pending' },
  { id: 4, name: '황소연', action: '공가 2일 신청 대기', date: '04.27', status: 'pending' },
];

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
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.gradient} p-5 shadow-lg ${card.shadow} flex flex-col gap-3`}>
      <div className="absolute -right-5 -top-5 h-24 w-24 rounded-full bg-white/10" />
      <div className="absolute right-3 bottom-3 h-16 w-16 rounded-full bg-white/5" />
      <div className="flex items-start justify-between relative z-10">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 text-white shadow-sm">
          {card.icon}
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/20 text-white/90 backdrop-blur-sm">
          {card.badge}
        </span>
      </div>
      <div className="relative z-10">
        <p className="text-sm font-medium text-white/80 mb-1">{card.label}</p>
        <div className="flex items-end gap-2">
          <span className="text-4xl font-bold text-white leading-none">{card.value}</span>
          <span className="text-sm text-white/70 mb-1">{card.sub}</span>
        </div>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white rounded-xl px-4 py-2.5 shadow-xl border border-slate-100 text-sm">
        <p className="font-semibold text-slate-700 mb-0.5">{label}</p>
        <p className="text-indigo-600 font-bold">{payload[0].value}%</p>
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const avgRate = Math.round(WEEKLY_DATA.reduce((s, d) => s + d.rate, 0) / WEEKLY_DATA.length);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page header */}
      <div className="bg-white border-b border-slate-100 px-6 py-5 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              안녕하세요, {user?.name ?? '관리자'}님 👋
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">{DATE_LABEL} · HR 대시보드</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-semibold text-emerald-700">오늘 출근율 87.5%</span>
          </div>
        </div>
      </div>

      <div className="p-6 lg:p-8 space-y-6">
        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {STAT_CARDS.map((card) => <StatCard key={card.label} card={card} />)}
        </div>

        {/* ── Middle row: Chart + Events ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Attendance area chart */}
          <div className="lg:col-span-3 rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-slate-800">주차별 출근률</h2>
                <p className="text-xs text-slate-400 mt-0.5">2026년 4월 · 주간 출근률 추이</p>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-1.5">
                <span className="text-xs text-slate-500">월 평균</span>
                <span className="text-sm font-bold text-indigo-600">{avgRate}%</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={WEEKLY_DATA} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="attendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[60, 100]}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fill="url(#attendGrad)"
                  dot={{ fill: '#6366f1', strokeWidth: 0, r: 5 }}
                  activeDot={{ r: 7, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Upcoming events */}
          <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-800">사내 일정 미리보기</h2>
              <Link to="/calendar" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
                전체 보기 →
              </Link>
            </div>
            <ul className="space-y-2.5">
              {EVENTS.map((ev, i) => (
                <li key={i} className={`flex items-center gap-3 rounded-xl border p-3 ${ev.color}`}>
                  <span className="shrink-0 text-[11px] font-bold whitespace-nowrap">{ev.date}</span>
                  <span className="text-sm font-medium truncate">{ev.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Bottom row ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* 이번 달 근태 요약 */}
          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
            <h2 className="text-base font-semibold text-slate-800 mb-4">이번 달 근태 요약</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-2.5 text-left text-xs font-semibold text-slate-400">부서</th>
                    <th className="pb-2.5 text-center text-xs font-semibold text-slate-400">인원</th>
                    <th className="pb-2.5 text-center text-xs font-semibold text-indigo-400">출근</th>
                    <th className="pb-2.5 text-center text-xs font-semibold text-amber-400">지각</th>
                    <th className="pb-2.5 text-center text-xs font-semibold text-emerald-400">휴가</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {ATTENDANCE_SUMMARY.map((row) => (
                    <tr key={row.dept} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 text-sm font-semibold text-slate-700">{row.dept}</td>
                      <td className="py-2.5 text-center text-slate-500 text-sm">{row.total}</td>
                      <td className="py-2.5 text-center">
                        <span className="text-indigo-600 font-bold text-sm">{row.present}</span>
                      </td>
                      <td className="py-2.5 text-center">
                        {row.late > 0
                          ? <span className="text-amber-500 font-bold text-sm">{row.late}</span>
                          : <span className="text-slate-200">—</span>}
                      </td>
                      <td className="py-2.5 text-center">
                        {row.leave > 0
                          ? <span className="text-emerald-500 font-bold text-sm">{row.leave}</span>
                          : <span className="text-slate-200">—</span>}
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
              <Link to="/announcements" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
                전체 보기 →
              </Link>
            </div>
            <ul className="space-y-2">
              {NOTICES.map((n) => (
                <li key={n.id}>
                  <Link
                    to={`/announcements/${n.id}`}
                    className="flex items-start gap-2.5 rounded-xl p-2.5 hover:bg-indigo-50/60 transition-colors group"
                  >
                    {n.pinned && (
                      <span className="mt-0.5 shrink-0 rounded-md bg-indigo-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        고정
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-700 truncate group-hover:text-indigo-700 transition-colors">{n.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{n.date}</p>
                    </div>
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              <Link to="/notifications" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
                전체 보기 →
              </Link>
            </div>
            <ul className="space-y-2.5">
              {NOTIFICATIONS.map((n) => (
                <li key={n.id} className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-slate-50 transition-colors">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-xs font-bold text-white shadow-sm shadow-indigo-200">
                    {(n?.name ?? '?').charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-700">{n?.name ?? '—'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{n.action}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    n.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
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
