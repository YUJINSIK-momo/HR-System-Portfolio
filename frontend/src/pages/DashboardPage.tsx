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
    badge: '정상 출근',
    tint: 'bg-notion-tint-sky',
    border: 'border-sky-100',
    iconBg: 'bg-sky-100',
    iconColor: 'text-sky-600',
    valueColor: 'text-sky-700',
    badgeClass: 'bg-sky-100 text-sky-700',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: '지각 인원',
    value: '1',
    sub: '명',
    badge: '박준혁',
    tint: 'bg-notion-tint-peach',
    border: 'border-orange-100',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
    valueColor: 'text-orange-700',
    badgeClass: 'bg-orange-100 text-orange-700',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: '휴가 중',
    value: '1',
    sub: '명',
    badge: '윤채원 (연차)',
    tint: 'bg-notion-tint-mint',
    border: 'border-emerald-100',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    valueColor: 'text-emerald-700',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
      </svg>
    ),
  },
  {
    label: '승인 대기',
    value: '3',
    sub: '건',
    badge: '처리 필요',
    tint: 'bg-notion-tint-lavender',
    border: 'border-violet-100',
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
    valueColor: 'text-violet-700',
    badgeClass: 'bg-violet-100 text-violet-700',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
];

const WEEKLY_DATA = [
  { week: '1주차', rate: 94 },
  { week: '2주차', rate: 91 },
  { week: '3주차', rate: 84 },
  { week: '4주차', rate: 78 },
  { week: '이번주', rate: 87 },
];

const EVENTS = [
  { date: '5월 2~3일', label: '신입사원 온보딩', dotColor: 'bg-violet-400' },
  { date: '5월 4일', label: '전사 월례 회의', dotColor: 'bg-sky-400' },
  { date: '5월 15일', label: '직원 워크숍', dotColor: 'bg-teal-400' },
  { date: '5월 20일', label: '개인정보 보호 교육', dotColor: 'bg-amber-400' },
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
    <div className={`rounded-notion-card border ${card.border} ${card.tint} p-5 shadow-notion-subtle flex flex-col gap-4`}>
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-notion-btn ${card.iconBg} ${card.iconColor}`}>
          {card.icon}
        </div>
        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${card.badgeClass}`}>
          {card.badge}
        </span>
      </div>
      <div>
        <p className="text-xs font-medium text-notion-slate mb-1.5">{card.label}</p>
        <div className="flex items-end gap-1.5">
          <span className={`text-4xl font-bold leading-none tracking-tight ${card.valueColor}`}>{card.value}</span>
          <span className={`text-sm mb-0.5 ${card.valueColor} opacity-60`}>{card.sub}</span>
        </div>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-notion-canvas rounded-notion-btn px-4 py-2.5 shadow-notion-card border border-notion-hairline text-sm">
        <p className="font-semibold text-notion-charcoal mb-0.5">{label}</p>
        <p className="text-violet-700 font-bold">{payload[0].value}%</p>
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const avgRate = Math.round(WEEKLY_DATA.reduce((s, d) => s + d.rate, 0) / WEEKLY_DATA.length);

  return (
    <div className="min-h-screen bg-notion-surface">
      {/* Page header */}
      <div className="bg-notion-canvas border-b border-notion-hairline px-6 py-5 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-notion-charcoal tracking-tight">
              안녕하세요, {user?.name ?? '관리자'}님
            </h1>
            <p className="mt-0.5 text-sm text-notion-steel">{DATE_LABEL} · HR 대시보드</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-notion-btn bg-emerald-50 border border-emerald-100 px-4 py-2">
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
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          {/* Attendance area chart */}
          <div className="lg:col-span-3 rounded-notion-card bg-notion-canvas border border-notion-hairline shadow-notion-subtle p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-[15px] font-semibold text-notion-charcoal tracking-tight">주차별 출근률</h2>
                <p className="text-xs text-notion-steel mt-0.5">2026년 4월 · 주간 출근률 추이</p>
              </div>
              <div className="flex items-center gap-2 rounded-notion-btn bg-notion-tint-lavender border border-violet-100 px-3 py-1.5">
                <span className="text-xs text-notion-slate">월 평균</span>
                <span className="text-sm font-bold text-violet-700">{avgRate}%</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={WEEKLY_DATA} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="attendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 12, fill: '#9B9B9B', fontFamily: 'Inter' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[60, 100]}
                  tick={{ fontSize: 11, fill: '#9B9B9B', fontFamily: 'Inter' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="#7C3AED"
                  strokeWidth={2}
                  fill="url(#attendGrad)"
                  dot={{ fill: '#7C3AED', strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6, fill: '#7C3AED', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Upcoming events */}
          <div className="lg:col-span-2 rounded-notion-card bg-notion-canvas border border-notion-hairline shadow-notion-subtle p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-semibold text-notion-charcoal tracking-tight">사내 일정 미리보기</h2>
              <Link to="/calendar" className="text-xs font-medium text-violet-700 hover:text-violet-900 transition-colors">
                전체 보기 →
              </Link>
            </div>
            <ul className="space-y-2">
              {EVENTS.map((ev, i) => (
                <li key={i} className="flex items-center gap-3 rounded-notion-btn bg-notion-surface border border-notion-hairline-soft px-3 py-2.5 hover:border-notion-hairline transition-colors">
                  <span className={`shrink-0 h-2 w-2 rounded-full ${ev.dotColor}`} />
                  <span className="text-[11px] font-semibold text-notion-steel whitespace-nowrap">{ev.date}</span>
                  <span className="text-sm font-medium text-notion-charcoal truncate">{ev.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Bottom row ── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* 이번 달 근태 요약 */}
          <div className="rounded-notion-card bg-notion-canvas border border-notion-hairline shadow-notion-subtle p-5">
            <h2 className="text-[15px] font-semibold text-notion-charcoal tracking-tight mb-4">이번 달 근태 요약</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-notion-hairline">
                    <th className="pb-2.5 text-left text-[11px] font-semibold text-notion-steel tracking-tight">부서</th>
                    <th className="pb-2.5 text-center text-[11px] font-semibold text-notion-steel">인원</th>
                    <th className="pb-2.5 text-center text-[11px] font-semibold text-sky-500">출근</th>
                    <th className="pb-2.5 text-center text-[11px] font-semibold text-orange-400">지각</th>
                    <th className="pb-2.5 text-center text-[11px] font-semibold text-emerald-500">휴가</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-notion-hairline-soft">
                  {ATTENDANCE_SUMMARY.map((row) => (
                    <tr key={row.dept} className="hover:bg-notion-surface transition-colors">
                      <td className="py-2.5 text-sm font-medium text-notion-charcoal">{row.dept}</td>
                      <td className="py-2.5 text-center text-notion-slate text-sm">{row.total}</td>
                      <td className="py-2.5 text-center">
                        <span className="text-sky-600 font-semibold text-sm">{row.present}</span>
                      </td>
                      <td className="py-2.5 text-center">
                        {row.late > 0
                          ? <span className="text-orange-500 font-semibold text-sm">{row.late}</span>
                          : <span className="text-notion-muted text-sm">—</span>}
                      </td>
                      <td className="py-2.5 text-center">
                        {row.leave > 0
                          ? <span className="text-emerald-600 font-semibold text-sm">{row.leave}</span>
                          : <span className="text-notion-muted text-sm">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 최근 공지사항 */}
          <div className="rounded-notion-card bg-notion-canvas border border-notion-hairline shadow-notion-subtle p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-semibold text-notion-charcoal tracking-tight">최근 공지사항</h2>
              <Link to="/announcements" className="text-xs font-medium text-violet-700 hover:text-violet-900 transition-colors">
                전체 보기 →
              </Link>
            </div>
            <ul className="space-y-1">
              {NOTICES.map((n) => (
                <li key={n.id}>
                  <Link
                    to={`/announcements/${n.id}`}
                    className="flex items-start gap-2.5 rounded-notion-btn px-2.5 py-2 hover:bg-notion-surface transition-colors group"
                  >
                    {n.pinned && (
                      <span className="mt-0.5 shrink-0 rounded bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wide">
                        고정
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-notion-charcoal truncate group-hover:text-violet-700 transition-colors">{n.title}</p>
                      <p className="text-[11px] text-notion-steel mt-0.5">{n.date}</p>
                    </div>
                    <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-notion-muted group-hover:text-violet-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 알림 목록 */}
          <div className="rounded-notion-card bg-notion-canvas border border-notion-hairline shadow-notion-subtle p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-semibold text-notion-charcoal tracking-tight">휴가 알림</h2>
              <Link to="/notifications" className="text-xs font-medium text-violet-700 hover:text-violet-900 transition-colors">
                전체 보기 →
              </Link>
            </div>
            <ul className="space-y-2">
              {NOTIFICATIONS.map((n) => (
                <li key={n.id} className="flex items-center gap-3 rounded-notion-btn px-2.5 py-2 hover:bg-notion-surface transition-colors">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-notion-tint-lavender border border-violet-100 text-xs font-bold text-violet-700">
                    {(n?.name ?? '?').charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-notion-charcoal leading-tight">{n?.name ?? '—'}</p>
                    <p className="text-xs text-notion-steel mt-0.5">{n.action}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                    n.status === 'approved'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      : 'bg-amber-50 text-amber-700 border border-amber-100'
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
