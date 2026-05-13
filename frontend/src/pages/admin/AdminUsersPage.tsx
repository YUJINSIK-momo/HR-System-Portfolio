import { useState, useMemo } from 'react';

const MOCK_USERS = [
  { id: 'm1', name: '김진식', email: 'admin@jinsik.com', position: '대표이사', department: '경영', role: 'SUPER_ADMIN', isActive: true, hireDate: '2020-01-15', leaveBalance: { totalDays: 15, usedDays: 3 } },
  { id: 'm2', name: '박준혁', email: 'junhyuk@jinsik.com', position: '개발팀장', department: '개발', role: 'MANAGER', isActive: true, hireDate: '2021-03-15', leaveBalance: { totalDays: 15, usedDays: 7 } },
  { id: 'm3', name: '최지은', email: 'jieun@jinsik.com', position: '프론트엔드 개발자', department: '개발', role: 'EMPLOYEE', isActive: true, hireDate: '2022-06-01', leaveBalance: { totalDays: 15, usedDays: 5 } },
  { id: 'm4', name: '정민준', email: 'minjun@jinsik.com', position: '백엔드 개발자', department: '개발', role: 'EMPLOYEE', isActive: true, hireDate: '2023-02-01', leaveBalance: { totalDays: 15, usedDays: 2 } },
  { id: 'm5', name: '윤채원', email: 'chaewon@jinsik.com', position: '마케터', department: '마케팅', role: 'EMPLOYEE', isActive: true, hireDate: '2022-09-01', leaveBalance: { totalDays: 15, usedDays: 8 } },
  { id: 'm6', name: '황소연', email: 'soyeon@jinsik.com', position: '기획자', department: '기획', role: 'PLANNING', isActive: true, hireDate: '2021-11-01', leaveBalance: { totalDays: 15, usedDays: 4 } },
  { id: 'm7', name: '이도현', email: 'dohyun@jinsik.com', position: 'CS 담당', department: 'CS', role: 'CS', isActive: true, hireDate: '2023-05-01', leaveBalance: { totalDays: 15, usedDays: 6 } },
  { id: 'm8', name: '강하늘', email: 'haneul@jinsik.com', position: 'UI 디자이너', department: '디자인', role: 'DESIGNER', isActive: true, hireDate: '2022-04-01', leaveBalance: { totalDays: 15, usedDays: 3 } },
];

const ROLE_MAP: Record<string, string> = {
  SUPER_ADMIN: '대표',
  MANAGER: '관리자',
  EMPLOYEE: '직원',
  PLANNING: '기획',
  CS: 'CS',
  DESIGNER: '디자이너',
  FOREIGN_FREELANCER: '프리랜서',
};

const DEPT_COLOR: Record<string, string> = {
  '경영': 'bg-violet-100 text-violet-700',
  '개발': 'bg-indigo-100 text-indigo-700',
  '마케팅': 'bg-pink-100 text-pink-700',
  '기획': 'bg-amber-100 text-amber-700',
  'CS': 'bg-teal-100 text-teal-700',
  '디자인': 'bg-rose-100 text-rose-700',
};

const AVATAR_GRAD = [
  'from-indigo-400 to-violet-500',
  'from-emerald-400 to-teal-500',
  'from-amber-400 to-orange-500',
  'from-rose-400 to-pink-500',
  'from-cyan-400 to-blue-500',
  'from-violet-400 to-purple-500',
  'from-teal-400 to-emerald-500',
  'from-orange-400 to-red-500',
];

export default function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('전체');

  const departments = ['전체', ...Array.from(new Set(MOCK_USERS.map(e => e.department)))];

  const filtered = useMemo(() => {
    return MOCK_USERS.filter(u => {
      const matchSearch =
        !search ||
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        u.position.toLowerCase().includes(search.toLowerCase());
      const matchDept = filterDept === '전체' || u.department === filterDept;
      return matchSearch && matchDept;
    });
  }, [search, filterDept]);

  const avgRemaining = Math.round(
    MOCK_USERS.reduce((s, u) => s + (u.leaveBalance.totalDays - u.leaveBalance.usedDays), 0) /
      MOCK_USERS.length
  );

  const statCards = [
    {
      label: '총 직원',
      value: MOCK_USERS.length,
      unit: '명',
      gradient: 'from-indigo-500 to-indigo-700',
      shadow: 'shadow-indigo-300',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      label: '재직중',
      value: MOCK_USERS.filter(e => e.isActive).length,
      unit: '명',
      gradient: 'from-emerald-500 to-teal-600',
      shadow: 'shadow-emerald-300',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: '부서 수',
      value: departments.length - 1,
      unit: '개',
      gradient: 'from-violet-500 to-purple-700',
      shadow: 'shadow-violet-300',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      label: '평균 잔여 연차',
      value: avgRemaining,
      unit: '일',
      gradient: 'from-amber-500 to-orange-600',
      shadow: 'shadow-amber-300',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-full bg-notion-surface p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-notion-charcoal tracking-tight">직원 관리</h2>
          <p className="text-sm text-notion-steel mt-0.5">전체 직원 현황 및 계정을 관리합니다</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 hover:opacity-90 transition-opacity">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          직원 추가
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map(card => (
          <div
            key={card.label}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.gradient} p-5 shadow-lg ${card.shadow}`}
          >
            <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/10" />
            <div className="absolute right-3 bottom-3 h-12 w-12 rounded-full bg-white/5" />
            <div className="relative z-10 flex flex-col gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white shadow-sm">
                {card.icon}
              </div>
              <div>
                <p className="text-sm font-medium text-white/80">{card.label}</p>
                <div className="flex items-end gap-1 mt-0.5">
                  <span className="text-3xl font-bold text-white leading-none">{card.value}</span>
                  <span className="text-sm text-white/70 mb-0.5">{card.unit}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 sm:max-w-xs">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="이름, 이메일, 직책 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent shadow-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {departments.map(dept => (
            <button
              key={dept}
              onClick={() => setFilterDept(dept)}
              className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                filterDept === dept
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-violet-700'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-notion-card bg-notion-canvas border border-notion-hairline shadow-notion-subtle overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">직원 목록</h3>
          <span className="text-xs text-slate-400 tabular-nums">{filtered.length}명</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">직원</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">부서 / 직책</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">연차 현황</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">권한</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">입사일</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((u, idx) => {
                const total = u.leaveBalance.totalDays;
                const used = u.leaveBalance.usedDays;
                const remaining = total - used;
                const usedPct = Math.round((used / total) * 100);
                return (
                  <tr key={u.id} className="hover:bg-notion-surface transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${AVATAR_GRAD[idx % AVATAR_GRAD.length]} text-sm font-bold text-white shadow-sm`}
                        >
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{u.name}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${DEPT_COLOR[u.department] ?? 'bg-slate-100 text-slate-600'}`}
                      >
                        {u.department}
                      </span>
                      <p className="text-xs text-slate-500 mt-0.5">{u.position}</p>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${usedPct >= 80 ? 'bg-rose-400' : usedPct >= 50 ? 'bg-amber-400' : 'bg-indigo-400'}`}
                            style={{ width: `${usedPct}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-slate-600">
                          <strong>{remaining}</strong>일 잔여
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 tabular-nums">
                        {used}/{total}일 사용
                      </p>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
                        {ROLE_MAP[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-sm text-slate-600 tabular-nums whitespace-nowrap">
                      {u.hireDate.replace(/-/g, '.')}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <button className="text-xs font-medium text-violet-700 hover:text-violet-900 transition-colors">
                          수정
                        </button>
                        <button className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors">
                          연차 설정
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-400">
                    검색 결과가 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
