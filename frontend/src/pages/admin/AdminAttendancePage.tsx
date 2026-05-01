import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const DEMO_EMPS = [
  { id: 'm1', name: '김진식', email: 'admin@jinsik.com' },
  { id: 'm2', name: '박준혁', email: 'junhyuk@jinsik.com' },
  { id: 'm3', name: '최지은', email: 'jieun@jinsik.com' },
  { id: 'm4', name: '정민준', email: 'minjun@jinsik.com' },
  { id: 'm5', name: '윤채원', email: 'chaewon@jinsik.com' },
  { id: 'm6', name: '황소연', email: 'soyeon@jinsik.com' },
  { id: 'm7', name: '이도현', email: 'dohyun@jinsik.com' },
  { id: 'm8', name: '강하늘', email: 'haneul@jinsik.com' },
];

function h(n: number): number {
  let x = n ^ (n >>> 16);
  x = Math.imul(x, 0x45d9f3b);
  x = x ^ (x >>> 16);
  return (x >>> 0) / 0xffffffff;
}

function buildMockRecords() {
  const results: any[] = [];
  const LEAVE_DAYS: Record<string, string[]> = {
    '2026-04-16': ['m5'],
    '2026-04-17': ['m5'],
    '2026-04-18': ['m5'],
  };
  for (let day = 1; day <= 28; day++) {
    const d = new Date(2026, 3, day);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const ds = `2026-04-${String(day).padStart(2, '0')}`;
    DEMO_EMPS.forEach((emp, ei) => {
      const seed = day * 31 + ei * 7;
      if (LEAVE_DAYS[ds]?.includes(emp.id)) {
        results.push({ id: `a-${emp.id}-${day}`, userId: emp.id, date: `${ds}T00:00:00.000Z`, checkIn: null, checkOut: null, status: 'ON_LEAVE', workLocation: null, user: { profile: { name: emp.name }, email: emp.email } });
        return;
      }
      if (emp.id !== 'm1' && h(seed * 3) < 0.04) {
        results.push({ id: `a-${emp.id}-${day}`, userId: emp.id, date: `${ds}T00:00:00.000Z`, checkIn: null, checkOut: null, status: 'ABSENT', workLocation: null, user: { profile: { name: emp.name }, email: emp.email } });
        return;
      }
      const isLate = (emp.id === 'm2' && h(seed) > 0.55) || (emp.id !== 'm2' && h(seed) > 0.93);
      const inMin = isLate ? 10 + Math.floor(h(seed * 5) * 25) : Math.floor(h(seed * 5) * 10);
      const outHH = 17 + Math.floor(h(seed * 9) * 2);
      const outMM = Math.floor(h(seed * 13) * 60);
      const wl = emp.id === 'm1' && h(seed * 17) > 0.88 ? 'OVERSEAS' : 'OFFICE';
      results.push({
        id: `a-${emp.id}-${day}`,
        userId: emp.id,
        date: `${ds}T00:00:00.000Z`,
        checkIn: `${ds}T09:${String(inMin).padStart(2, '0')}:00.000Z`,
        checkOut: `${ds}T${String(outHH).padStart(2, '0')}:${String(outMM).padStart(2, '0')}:00.000Z`,
        status: isLate ? 'LATE' : 'NORMAL',
        workLocation: wl,
        user: { profile: { name: emp.name }, email: emp.email },
      });
    });
  }
  return results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

const MOCK_RECORDS = buildMockRecords();

const MOCK_CORRECTIONS = [
  {
    id: 'c1',
    kind: 'EDIT_TIMES',
    workDate: '2026-04-25T00:00:00.000Z',
    proposedCheckIn: '2026-04-25T09:05:00.000Z',
    proposedCheckOut: '2026-04-25T18:30:00.000Z',
    reason: '단말기 오류로 퇴근 시간이 잘못 기록되었습니다.',
    user: { profile: { name: '정민준' }, email: 'minjun@jinsik.com' },
  },
];

const PAGE_SIZE = 20;

export default function AdminAttendancePage() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState('2026-04');
  const [viewMode, setViewMode] = useState<'date' | 'list'>('date');
  const [attPage, setAttPage] = useState(1);
  const [pendingCorrections, setPendingCorrections] = useState<any[]>(MOCK_CORRECTIONS);
  const [records, setRecords] = useState<any[]>(MOCK_RECORDS);
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(null);
  const [editTarget, setEditTarget] = useState<{ id: string; name: string; checkIn: string; checkOut: string; date: string } | null>(null);

  const locale = 'ko-KR';

  const toTimeOnly = (iso: string | null | undefined) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const [startDate, endDate] = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
  }, [selectedMonth]);

  const filteredRecords = useMemo(
    () => records.filter(r => {
      const d = new Date(r.date).toISOString().slice(0, 10);
      return d >= startDate && d <= endDate;
    }),
    [records, startDate, endDate]
  );

  const chartData = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const byDate: Record<string, { count: number; date: string; label: string }> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      byDate[key] = { date: key, count: 0, label: `${d}일` };
    }
    filteredRecords.forEach(r => {
      if (r.checkIn) {
        const key = new Date(r.date).toISOString().slice(0, 10);
        if (byDate[key]) byDate[key].count += 1;
      }
    });
    return Object.values(byDate);
  }, [filteredRecords, selectedMonth]);

  const summary = useMemo(() => {
    const uniqueIds = new Set(filteredRecords.map(r => r.userId));
    const withCheckIn = filteredRecords.filter(r => r.checkIn);
    const [y, m] = selectedMonth.split('-').map(Number);
    const workDays = new Date(y, m, 0).getDate();
    return {
      totalDays: withCheckIn.length,
      uniqueEmployees: uniqueIds.size,
      avgPerDay: workDays > 0 ? (withCheckIn.length / workDays).toFixed(1) : 0,
    };
  }, [filteredRecords, selectedMonth]);

  const recordsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    filteredRecords.forEach(r => {
      const key = new Date(r.date).toISOString().slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return Object.fromEntries(Object.entries(map).sort(([a], [b]) => b.localeCompare(a)));
  }, [filteredRecords]);

  const attTotalPages = Math.ceil(filteredRecords.length / PAGE_SIZE) || 1;
  const attPaginatedRecords = useMemo(
    () => filteredRecords.slice((attPage - 1) * PAGE_SIZE, attPage * PAGE_SIZE),
    [filteredRecords, attPage]
  );

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  const attendanceStatusLabel = (r: { status?: string; workLocation?: string | null }) => {
    if (r.status === 'LATE') return r.workLocation === 'OVERSEAS' ? '지각 (해외근무)' : '지각 출근';
    if (r.status === 'EARLY_LEAVE') return '조기 퇴근';
    if (r.status === 'ABSENT') return '결근';
    if (r.status === 'ON_LEAVE') return '휴가';
    return r.workLocation === 'OVERSEAS' ? '해외근무' : '정상 출근';
  };

  const handleApproveCorrection = (id: string) => {
    setPendingCorrections(prev => prev.filter(c => c.id !== id));
  };
  const handleRejectCorrection = (id: string) => {
    setPendingCorrections(prev => prev.filter(c => c.id !== id));
  };

  const handleResetAttendance = (id: string) => {
    setRecords(prev =>
      prev.map(r => r.id === id ? { ...r, checkIn: null, checkOut: null, status: 'ABSENT' } : r)
    );
    setResetTarget(null);
  };

  const handleUpdateAttendance = (id: string, checkIn?: string | null, checkOut?: string | null) => {
    setRecords(prev =>
      prev.map(r => {
        if (r.id !== id) return r;
        const newCheckIn = checkIn !== undefined ? checkIn : r.checkIn;
        const newCheckOut = checkOut !== undefined ? checkOut : r.checkOut;
        return { ...r, checkIn: newCheckIn, checkOut: newCheckOut };
      })
    );
    setEditTarget(null);
  };

  return (
    <div className="min-h-full bg-slate-50 p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">근태 현황</h2>
          <p className="text-sm text-slate-500 mt-0.5">직원별 월간 출퇴근 기록을 확인하고 관리합니다</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-40"
          />
          <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            엑셀 내보내기
          </button>
        </div>
      </div>

      {/* Pending corrections */}
      {pendingCorrections.length > 0 && (
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-6 mb-6">
          <h3 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-amber-50 px-1.5 text-xs font-bold text-amber-700 ring-1 ring-amber-100">
              {pendingCorrections.length}
            </span>
            근태 정정 요청
          </h3>
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">직원</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">유형</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">날짜</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">정정 출근</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">정정 퇴근</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">사유</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">처리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pendingCorrections.map(c => {
                  const name = c.user?.profile?.name || c.user?.email || '';
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">{name}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {c.kind === 'ADD_MISSING' ? '누락 추가' : '시간 수정'}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">
                        {new Date(c.workDate).toLocaleDateString(locale)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">
                        {c.proposedCheckIn ? formatTime(c.proposedCheckIn) : '—'}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">
                        {c.proposedCheckOut ? formatTime(c.proposedCheckOut) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate" title={c.reason || ''}>
                        {c.reason || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleApproveCorrection(c.id)}
                            className="text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 rounded-xl transition-colors"
                          >
                            승인
                          </button>
                          <button
                            onClick={() => handleRejectCorrection(c.id)}
                            className="text-xs font-semibold rounded-xl border border-rose-300 text-rose-600 hover:bg-rose-50 px-3 py-1.5 transition-colors"
                          >
                            반려
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shrink-0 shadow-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-slate-600 mb-0.5">월 누적 출근 횟수</p>
            <p className="text-3xl font-bold text-slate-900 tabular-nums">
              {summary.totalDays}
              <span className="text-base font-normal text-slate-400 ml-0.5">회</span>
            </p>
          </div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shrink-0 shadow-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-slate-600 mb-0.5">출근 직원 수</p>
            <p className="text-3xl font-bold text-slate-900 tabular-nums">
              {summary.uniqueEmployees}
              <span className="text-base font-normal text-slate-400 ml-0.5">명</span>
            </p>
          </div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shrink-0 shadow-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-slate-600 mb-0.5">일 평균 출근 인원</p>
            <p className="text-3xl font-bold text-slate-900 tabular-nums">
              {summary.avgPerDay}
              <span className="text-base font-normal text-slate-400 ml-0.5">명</span>
            </p>
          </div>
        </div>
      </div>

      {/* Bar chart */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5 mb-6">
        <h3 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          일별 출근 현황
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} width={28} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                formatter={(value: any) => [`${value ?? 0}명`, '출근 인원']}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={32}>
                {chartData.map((entry, index) => {
                  const today = new Date();
                  const entryDate = new Date(entry.date);
                  const isToday = entryDate.toDateString() === today.toDateString();
                  return (
                    <Cell
                      key={index}
                      fill={entry.count > 0 ? (isToday ? '#4f46e5' : '#818cf8') : '#f1f5f9'}
                      stroke={isToday && entry.count > 0 ? '#3730a3' : undefined}
                      strokeWidth={isToday ? 1 : 0}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-slate-400 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-indigo-400" /> 출근 기록 있음
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-slate-200" /> 출근 기록 없음
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-indigo-600 ring-1 ring-indigo-700 ring-offset-1" /> 오늘
          </span>
        </div>
      </div>

      {/* Reset modal */}
      {resetTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800 mb-2">출근 기록 초기화</h3>
            <p className="text-sm text-slate-600 mb-4">
              <strong>{resetTarget.name}</strong>의 출근 기록을 초기화하시겠습니까?
            </p>
            <p className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-xl mb-5">이 작업은 되돌릴 수 없습니다.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setResetTarget(null)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => handleResetAttendance(resetTarget.id)}
                className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 transition-colors"
              >
                초기화
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit time modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800 mb-2">출퇴근 시간 수정</h3>
            <p className="text-sm text-slate-600 mb-4">
              <strong>{editTarget.name}</strong> · {new Date(editTarget.date).toLocaleDateString(locale)}
            </p>
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">출근 시간</label>
                <input
                  type="time"
                  value={editTarget.checkIn}
                  onChange={e => setEditTarget(p => p ? { ...p, checkIn: e.target.value } : null)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">퇴근 시간</label>
                <input
                  type="time"
                  value={editTarget.checkOut}
                  onChange={e => setEditTarget(p => p ? { ...p, checkOut: e.target.value } : null)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditTarget(null)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() =>
                  handleUpdateAttendance(
                    editTarget.id,
                    editTarget.checkIn ? `${editTarget.date}T${editTarget.checkIn}:00.000Z` : null,
                    editTarget.checkOut ? `${editTarget.date}T${editTarget.checkOut}:00.000Z` : null
                  )
                }
                className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 hover:opacity-90 transition-opacity"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail records */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-800">상세 기록</h3>
          <div className="flex rounded-xl border border-slate-200 p-0.5 bg-slate-50">
            <button
              onClick={() => setViewMode('date')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors min-w-[72px] ${viewMode === 'date' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
            >
              날짜별
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors min-w-[72px] ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
            >
              목록
            </button>
          </div>
        </div>

        {filteredRecords.length === 0 && (
          <p className="px-6 py-12 text-center text-sm text-slate-400">기록이 없습니다</p>
        )}

        {filteredRecords.length > 0 && viewMode === 'date' && (
          <div className="p-4 sm:p-6 space-y-4">
            {Object.entries(recordsByDate).map(([dateKey, list]) => {
              const dateObj = new Date(dateKey);
              const isTodayDate = dateObj.toDateString() === now.toDateString();
              return (
                <div
                  key={dateKey}
                  className={`rounded-xl border overflow-hidden ${isTodayDate ? 'ring-2 ring-indigo-200 border-indigo-200' : 'border-slate-100 bg-white'}`}
                >
                  <div className={`px-4 py-2.5 flex items-center justify-between ${isTodayDate ? 'bg-indigo-50' : 'bg-slate-50'}`}>
                    <span className={`text-sm font-semibold ${isTodayDate ? 'text-indigo-800' : 'text-slate-800'}`}>
                      {dateObj.toLocaleDateString(locale, { month: 'long', day: 'numeric', weekday: 'short' })}
                      {isTodayDate && <span className="ml-2 text-xs font-normal text-indigo-600">(오늘)</span>}
                    </span>
                    <span className="text-xs font-medium text-slate-400 bg-white/80 px-2 py-0.5 rounded-full">
                      {(list as any[]).length}명
                    </span>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {(list as any[]).map(r => {
                      const name = r.user?.profile?.name || r.user?.email;
                      return (
                        <div
                          key={r.id}
                          className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 px-4 sm:flex-nowrap hover:bg-slate-50/70 transition-colors"
                        >
                          <span className="font-medium text-slate-800 w-20 sm:w-auto">{name}</span>
                          <span
                            className={`text-xs px-2.5 py-1 rounded-full shrink-0 font-semibold ${
                              r.status === 'LATE'
                                ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-100'
                                : r.status === 'ON_LEAVE'
                                ? 'bg-teal-50 text-teal-700 ring-1 ring-teal-100'
                                : r.status === 'ABSENT'
                                ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-100'
                                : r.workLocation === 'OVERSEAS'
                                ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100'
                                : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                            }`}
                          >
                            {attendanceStatusLabel(r)}
                          </span>
                          <span className="text-sm text-slate-600 flex items-center gap-1.5 shrink-0">
                            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {r.checkIn ? formatTime(r.checkIn) : '-'} → {r.checkOut ? formatTime(r.checkOut) : '-'}
                          </span>
                          <div className="flex gap-2 shrink-0 ml-auto">
                            <button
                              onClick={() => {
                                const dk = new Date(r.date).toISOString().slice(0, 10);
                                setEditTarget({
                                  id: r.id,
                                  name,
                                  date: dk,
                                  checkIn: r.checkIn ? toTimeOnly(r.checkIn) : '09:00',
                                  checkOut: r.checkOut ? toTimeOnly(r.checkOut) : '18:00',
                                });
                              }}
                              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                            >
                              시간 수정
                            </button>
                            <button
                              onClick={() => setResetTarget({ id: r.id, name })}
                              className="text-xs font-medium text-rose-500 hover:text-rose-700 transition-colors"
                            >
                              초기화
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredRecords.length > 0 && viewMode === 'list' && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">직원</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">날짜</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">출근</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">퇴근</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">상태</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {attPaginatedRecords.map(r => {
                    const name = r.user?.profile?.name || r.user?.email;
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-3 font-medium text-slate-800">{name}</td>
                        <td className="px-6 py-3 text-slate-600 tabular-nums">
                          {new Date(r.date).toLocaleDateString(locale)}
                        </td>
                        <td className="px-6 py-3 text-slate-600 tabular-nums">
                          {r.checkIn ? formatTime(r.checkIn) : '—'}
                        </td>
                        <td className="px-6 py-3 text-slate-600 tabular-nums">
                          {r.checkOut ? formatTime(r.checkOut) : '—'}
                        </td>
                        <td className="px-6 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              r.status === 'LATE'
                                ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-100'
                                : r.status === 'ON_LEAVE'
                                ? 'bg-teal-50 text-teal-700 ring-1 ring-teal-100'
                                : r.status === 'ABSENT'
                                ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-100'
                                : r.workLocation === 'OVERSEAS'
                                ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100'
                                : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                            }`}
                          >
                            {attendanceStatusLabel(r)}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const dateKey = new Date(r.date).toISOString().slice(0, 10);
                                setEditTarget({
                                  id: r.id,
                                  name,
                                  date: dateKey,
                                  checkIn: r.checkIn ? toTimeOnly(r.checkIn) : '09:00',
                                  checkOut: r.checkOut ? toTimeOnly(r.checkOut) : '18:00',
                                });
                              }}
                              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                            >
                              시간 수정
                            </button>
                            <button
                              onClick={() => setResetTarget({ id: r.id, name })}
                              className="text-xs font-medium text-rose-500 hover:text-rose-700 transition-colors"
                            >
                              초기화
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {attTotalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-sm text-slate-400">총 {filteredRecords.length}건</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAttPage(p => Math.max(1, p - 1))}
                    disabled={attPage <= 1}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                  >
                    ←
                  </button>
                  <span className="px-3 py-1.5 text-sm text-slate-600">
                    {attPage} / {attTotalPages}
                  </span>
                  <button
                    onClick={() => setAttPage(p => Math.min(attTotalPages, p + 1))}
                    disabled={attPage >= attTotalPages}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                  >
                    →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
