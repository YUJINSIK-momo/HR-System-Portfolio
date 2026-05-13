import { useState, useMemo } from 'react';

type TabType = 'requests' | 'usage';

const MOCK_USERS = [
  { id: 'm1', name: '김진식', email: 'admin@jinsik.com', isActive: true, leaveBalance: { totalDays: 15, usedDays: 3 } },
  { id: 'm2', name: '박준혁', email: 'junhyuk@jinsik.com', isActive: true, leaveBalance: { totalDays: 15, usedDays: 7 } },
  { id: 'm3', name: '최지은', email: 'jieun@jinsik.com', isActive: true, leaveBalance: { totalDays: 15, usedDays: 5 } },
  { id: 'm4', name: '정민준', email: 'minjun@jinsik.com', isActive: true, leaveBalance: { totalDays: 15, usedDays: 2 } },
  { id: 'm5', name: '윤채원', email: 'chaewon@jinsik.com', isActive: true, leaveBalance: { totalDays: 15, usedDays: 8 } },
  { id: 'm6', name: '황소연', email: 'soyeon@jinsik.com', isActive: true, leaveBalance: { totalDays: 15, usedDays: 4 } },
  { id: 'm7', name: '이도현', email: 'dohyun@jinsik.com', isActive: true, leaveBalance: { totalDays: 15, usedDays: 6 } },
  { id: 'm8', name: '강하늘', email: 'haneul@jinsik.com', isActive: true, leaveBalance: { totalDays: 15, usedDays: 3 } },
];

const MOCK_REQUESTS_INIT = [
  // 대기중
  { id: 'r1', userId: 'm3', user: { id: 'm3', profile: { name: '최지은' }, email: 'jieun@jinsik.com' }, type: 'HALF_DAY_AM', startDate: '2026-05-02', endDate: '2026-05-02', days: 0.5, reason: '병원 예약', status: 'PENDING' },
  { id: 'r2', userId: 'm4', user: { id: 'm4', profile: { name: '정민준' }, email: 'minjun@jinsik.com' }, type: 'SICK', startDate: '2026-05-05', endDate: '2026-05-05', days: 1, reason: '감기 몸살', status: 'PENDING' },
  { id: 'r3', userId: 'm7', user: { id: 'm7', profile: { name: '이도현' }, email: 'dohyun@jinsik.com' }, type: 'OFFICIAL', startDate: '2026-05-08', endDate: '2026-05-09', days: 2, reason: '외부 교육 참가', status: 'PENDING' },
  // 승인됨
  { id: 'r4', userId: 'm2', user: { id: 'm2', profile: { name: '박준혁' }, email: 'junhyuk@jinsik.com' }, type: 'ANNUAL', startDate: '2026-04-21', endDate: '2026-04-22', days: 2, reason: '개인 사정', status: 'APPROVED' },
  { id: 'r5', userId: 'm5', user: { id: 'm5', profile: { name: '윤채원' }, email: 'chaewon@jinsik.com' }, type: 'ANNUAL', startDate: '2026-04-16', endDate: '2026-04-18', days: 3, reason: '해외 여행', status: 'APPROVED' },
  { id: 'r6', userId: 'm6', user: { id: 'm6', profile: { name: '황소연' }, email: 'soyeon@jinsik.com' }, type: 'HALF_DAY_PM', startDate: '2026-04-10', endDate: '2026-04-10', days: 0.5, reason: '개인 용무', status: 'APPROVED' },
  { id: 'r7', userId: 'm8', user: { id: 'm8', profile: { name: '강하늘' }, email: 'haneul@jinsik.com' }, type: 'SICK', startDate: '2026-04-07', endDate: '2026-04-07', days: 1, reason: '독감', status: 'APPROVED' },
  { id: 'r8', userId: 'm3', user: { id: 'm3', profile: { name: '최지은' }, email: 'jieun@jinsik.com' }, type: 'ANNUAL', startDate: '2026-03-24', endDate: '2026-03-25', days: 2, reason: '가족 행사', status: 'APPROVED' },
  { id: 'r9', userId: 'm7', user: { id: 'm7', profile: { name: '이도현' }, email: 'dohyun@jinsik.com' }, type: 'ANNUAL', startDate: '2026-03-13', endDate: '2026-03-14', days: 2, reason: '개인 휴가', status: 'APPROVED' },
  // 반려됨
  { id: 'r10', userId: 'm4', user: { id: 'm4', profile: { name: '정민준' }, email: 'minjun@jinsik.com' }, type: 'ANNUAL', startDate: '2026-04-14', endDate: '2026-04-15', days: 2, reason: '개인 사정', status: 'REJECTED' },
  { id: 'r11', userId: 'm2', user: { id: 'm2', profile: { name: '박준혁' }, email: 'junhyuk@jinsik.com' }, type: 'OFFICIAL', startDate: '2026-03-03', endDate: '2026-03-03', days: 1, reason: '외부 미팅', status: 'REJECTED' },
];

const TYPE_LABEL: Record<string, string> = {
  ANNUAL: '연차',
  HALF_DAY_AM: '반차 (오전)',
  HALF_DAY_PM: '반차 (오후)',
  QUARTER_DAY: '반반차',
  SICK: '병가',
  OFFICIAL: '공가',
  FAMILY: '경조사',
};

export default function AdminLeavePage() {
  const [activeTab, setActiveTab] = useState<TabType>('requests');
  const [selectedYear, setSelectedYear] = useState(2026);
  const [requests, setRequests] = useState(MOCK_REQUESTS_INIT);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; name: string } | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null);

  const locale = 'ko-KR';

  const handleApprove = (id: string) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'APPROVED' } : r));
  };

  const handleReject = (id: string) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'REJECTED' } : r));
    setRejectTarget(null);
  };

  const handleRevoke = (id: string) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'REJECTED' } : r));
    setRevokeTarget(null);
  };

  const pendingRequests = requests.filter(r => r.status === 'PENDING');

  const historyRequests = useMemo(
    () => requests.filter(r => r.status !== 'PENDING' && new Date(r.startDate).getFullYear() === selectedYear),
    [requests, selectedYear]
  );

  const historyByMonth = useMemo(() => {
    const map: Record<string, any[]> = {};
    historyRequests.forEach(r => {
      const d = new Date(r.startDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return Object.fromEntries(Object.entries(map).sort(([a], [b]) => b.localeCompare(a)));
  }, [historyRequests]);

  const employeeUsage = useMemo(() => {
    const approved = requests.filter(r => r.status === 'APPROVED' && new Date(r.startDate).getFullYear() === selectedYear);
    return MOCK_USERS.filter(u => u.isActive).map(u => {
      const myLeaves = approved.filter(r => r.userId === u.id);
      const totalUsed = myLeaves.reduce((sum, r) => sum + r.days, 0);
      const lb = u.leaveBalance;
      const remaining = lb.totalDays - lb.usedDays;
      return { ...u, myLeaves, totalUsed, remaining };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [requests, selectedYear]);

  // Summary stats
  const totalApproved = requests.filter(r => r.status === 'APPROVED').length;
  const totalPending = pendingRequests.length;
  const totalDaysUsed = requests
    .filter(r => r.status === 'APPROVED' && new Date(r.startDate).getFullYear() === selectedYear)
    .reduce((sum, r) => sum + r.days, 0);

  return (
    <div className="min-h-full bg-notion-surface p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-notion-charcoal tracking-tight">휴가 신청 관리</h2>
          <p className="text-sm text-notion-steel mt-0.5">직원 휴가 신청을 승인·반려하고 현황을 확인합니다</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            엑셀 내보내기
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'requests'
                ? 'bg-violet-700 text-white shadow-md shadow-indigo-200'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
            }`}
          >
            신청 관리
            {totalPending > 0 && (
              <span className="ml-1.5 bg-white/30 px-1.5 rounded text-xs font-semibold">{totalPending}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('usage')}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'usage'
                ? 'bg-violet-700 text-white shadow-md shadow-indigo-200'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
            }`}
          >
            연차 현황
          </button>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-notion-card bg-notion-canvas border border-notion-hairline shadow-notion-subtle p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shrink-0 shadow-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-slate-600 mb-0.5">승인 대기</p>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-bold text-slate-900 leading-none tabular-nums">{totalPending}</span>
              <span className="text-base font-normal text-slate-400 mb-0.5">건</span>
            </div>
          </div>
        </div>
        <div className="rounded-notion-card bg-notion-canvas border border-notion-hairline shadow-notion-subtle p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shrink-0 shadow-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-slate-600 mb-0.5">올해 승인 건수</p>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-bold text-slate-900 leading-none tabular-nums">{totalApproved}</span>
              <span className="text-base font-normal text-slate-400 mb-0.5">건</span>
            </div>
          </div>
        </div>
        <div className="rounded-notion-card bg-notion-canvas border border-notion-hairline shadow-notion-subtle p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
          <div className="p-2.5 rounded-xl bg-violet-700 text-white shrink-0 shadow-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-slate-600 mb-0.5">올해 사용 연차</p>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-bold text-slate-900 leading-none tabular-nums">{totalDaysUsed}</span>
              <span className="text-base font-normal text-slate-400 mb-0.5">일</span>
            </div>
          </div>
        </div>
      </div>

      {/* Revoke modal */}
      {revokeTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800 mb-2">승인 취소</h3>
            <p className="text-sm text-slate-600 mb-4">
              <strong>{revokeTarget.name}</strong>의 휴가 승인을 취소하시겠습니까?
            </p>
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-xl mb-5">
              연차 잔여 일수가 복구됩니다.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setRevokeTarget(null)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => handleRevoke(revokeTarget.id)}
                className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 transition-colors"
              >
                승인 취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800 mb-2">휴가 반려</h3>
            <p className="text-sm text-slate-600 mb-4">
              <strong>{rejectTarget.name}</strong>의 휴가 신청을 반려하시겠습니까?
            </p>
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-xl mb-5">
              신청자에게 반려 알림이 발송됩니다.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setRejectTarget(null)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => handleReject(rejectTarget.id)}
                className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 transition-colors"
              >
                반려
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">연도</label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent"
            >
              {[2027, 2026, 2025].map(y => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
          </div>

          {/* Pending requests */}
          {pendingRequests.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                승인 대기 ({pendingRequests.length}건)
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {pendingRequests.map(r => (
                  <div
                    key={r.id}
                    className="rounded-2xl bg-amber-50/60 border border-amber-200 p-5 flex flex-col gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800 truncate">{r.user?.profile?.name || r.user?.email}</p>
                      <p className="text-sm text-slate-600 mt-0.5 break-words">
                        {TYPE_LABEL[r.type] ?? r.type}
                        {' · '}
                        {new Date(r.startDate).toLocaleDateString(locale)}
                        {r.startDate !== r.endDate && ` ~ ${new Date(r.endDate).toLocaleDateString(locale)}`}
                        {' · '}
                        {r.days}일
                      </p>
                      {r.reason && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{r.reason}</p>}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                      <button
                        onClick={() => handleApprove(r.id)}
                        className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 text-sm font-semibold transition-colors"
                      >
                        승인
                      </button>
                      <button
                        onClick={() => setRejectTarget({ id: r.id, name: r.user?.profile?.name || r.user?.email })}
                        className="rounded-xl border border-rose-300 text-rose-600 hover:bg-rose-50 px-4 py-2 text-sm font-semibold transition-colors"
                      >
                        반려
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingRequests.length === 0 && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-5 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-emerald-700">현재 승인 대기 중인 휴가 신청이 없습니다.</p>
            </div>
          )}

          {/* History */}
          <div className="rounded-notion-card bg-notion-canvas border border-notion-hairline shadow-notion-subtle overflow-hidden">
            <h3 className="px-4 sm:px-6 py-4 text-\[15px\] font-semibold text-notion-charcoal tracking-tight border-b border-slate-100 flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              처리 이력
            </h3>
            {Object.keys(historyByMonth).length === 0 && (
              <p className="px-6 py-10 text-center text-sm text-slate-400">처리된 이력이 없습니다</p>
            )}
            {Object.keys(historyByMonth).length > 0 && (
              <div className="divide-y divide-slate-50">
                {Object.entries(historyByMonth).map(([monthKey, list]) => {
                  const [y, m] = monthKey.split('-').map(Number);
                  const monthLabel = new Date(y, m - 1).toLocaleDateString(locale, { year: 'numeric', month: 'long' });
                  return (
                    <div key={monthKey} className="p-4 sm:p-6">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                          <span className="w-1.5 h-4 rounded bg-indigo-500" />
                          {monthLabel}
                        </h4>
                        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                          {list.length}건
                        </span>
                      </div>
                      {/* Desktop */}
                      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-100">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">직원</th>
                              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">유형</th>
                              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">기간</th>
                              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">일수</th>
                              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">상태</th>
                              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">관리</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {(list as any[]).map(r => (
                              <tr key={r.id} className="hover:bg-notion-surface transition-colors">
                                <td className="px-4 py-2.5 font-medium text-slate-800">
                                  {r.user?.profile?.name || r.user?.email}
                                </td>
                                <td className="px-4 py-2.5 text-slate-600">{TYPE_LABEL[r.type] ?? r.type}</td>
                                <td className="px-4 py-2.5 text-slate-600">
                                  {new Date(r.startDate).toLocaleDateString(locale)}
                                  {r.startDate !== r.endDate && ` ~ ${new Date(r.endDate).toLocaleDateString(locale)}`}
                                </td>
                                <td className="px-4 py-2.5 text-slate-600">{r.days}일</td>
                                <td className="px-4 py-2.5">
                                  <span
                                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                      r.status === 'APPROVED'
                                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                                        : 'bg-rose-50 text-rose-700 ring-1 ring-rose-100'
                                    }`}
                                  >
                                    {r.status === 'APPROVED' ? '승인' : '반려'}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">
                                  {r.status === 'APPROVED' && (
                                    <button
                                      onClick={() =>
                                        setRevokeTarget({ id: r.id, name: r.user?.profile?.name || r.user?.email })
                                      }
                                      className="text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors"
                                    >
                                      승인 취소
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {/* Mobile */}
                      <div className="md:hidden space-y-2">
                        {(list as any[]).map(r => (
                          <div key={r.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                            <div className="flex justify-between items-start gap-3">
                              <span className="font-semibold text-slate-800">
                                {r.user?.profile?.name || r.user?.email}
                              </span>
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0 ${
                                  r.status === 'APPROVED'
                                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                                    : 'bg-rose-50 text-rose-700 ring-1 ring-rose-100'
                                }`}
                              >
                                {r.status === 'APPROVED' ? '승인' : '반려'}
                              </span>
                            </div>
                            <p className="text-sm text-slate-600 mt-1">
                              {TYPE_LABEL[r.type] ?? r.type} ·{' '}
                              {new Date(r.startDate).toLocaleDateString(locale)}
                              {r.startDate !== r.endDate && ` ~ ${new Date(r.endDate).toLocaleDateString(locale)}`}
                              {' · '}
                              {r.days}일
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'usage' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">연도</label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent"
            >
              {[2027, 2026, 2025].map(y => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
          </div>

          <div className="rounded-notion-card bg-notion-canvas border border-notion-hairline shadow-notion-subtle overflow-hidden">
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide sticky left-0 bg-slate-50 z-10 min-w-[120px]">
                      직원
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                      연차 현황
                      <span className="block text-xs font-normal text-slate-400 mt-0.5 normal-case">총 · 사용 · 잔여</span>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide min-w-[280px]">
                      사용 내역
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {employeeUsage.map(emp => (
                    <tr key={emp.id} className="hover:bg-notion-surface transition-colors">
                      <td className="px-6 py-3 font-medium text-slate-800 sticky left-0 bg-white z-10">
                        {emp.name || emp.email}
                      </td>
                      <td className="px-6 py-3.5 text-slate-600">
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                          <span>
                            <span className="text-slate-400">총</span>{' '}
                            <strong className="text-slate-700">{emp.leaveBalance.totalDays}</strong>일
                          </span>
                          <span>
                            <span className="text-slate-400">사용</span>{' '}
                            <strong className="text-violet-700">{emp.leaveBalance.usedDays}</strong>일
                          </span>
                          <span>
                            <span className="text-slate-400">잔여</span>{' '}
                            <strong className="text-emerald-600">{emp.remaining}</strong>일
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-slate-600">
                        {emp.myLeaves.length === 0 ? (
                          <span className="text-slate-400">-</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {emp.myLeaves
                              .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                              .map(r => {
                                const start = new Date(r.startDate);
                                const end = new Date(r.endDate);
                                const range =
                                  start.getTime() === end.getTime()
                                    ? start.toLocaleDateString(locale)
                                    : `${start.toLocaleDateString(locale)}~${end.toLocaleDateString(locale)}`;
                                return (
                                  <span
                                    key={r.id}
                                    className="inline-flex items-center rounded-lg px-2 py-0.5 text-xs bg-indigo-50 text-indigo-700"
                                    title={r.reason || ''}
                                  >
                                    {TYPE_LABEL[r.type] ?? r.type} {range} ({r.days}일)
                                  </span>
                                );
                              })}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile */}
            <div className="md:hidden divide-y divide-slate-50">
              {employeeUsage.map(emp => (
                <div key={emp.id} className="p-4 flex flex-col gap-3">
                  <p className="font-semibold text-slate-800">{emp.name || emp.email}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                    <span>
                      <span className="text-slate-400">총</span>{' '}
                      <strong className="text-slate-700">{emp.leaveBalance.totalDays}</strong>일
                    </span>
                    <span>
                      <span className="text-slate-400">사용</span>{' '}
                      <strong className="text-violet-700">{emp.leaveBalance.usedDays}</strong>일
                    </span>
                    <span>
                      <span className="text-slate-400">잔여</span>{' '}
                      <strong className="text-emerald-600">{emp.remaining}</strong>일
                    </span>
                  </div>
                  {emp.myLeaves.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {emp.myLeaves.map(r => (
                        <span
                          key={r.id}
                          className="inline-block rounded-lg px-2 py-0.5 text-xs bg-indigo-50 text-indigo-700"
                        >
                          {TYPE_LABEL[r.type] ?? r.type} ({r.days}일)
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
