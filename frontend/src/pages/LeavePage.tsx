import { useState, useMemo } from 'react';

type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type LeaveType = 'ANNUAL' | 'HALF_AM' | 'HALF_PM' | 'SICK' | 'OFFICIAL';

interface LeaveRequest {
  id: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
}

interface LeaveBalance {
  id: string;
  name: string;
  totalDays: number;
  usedDays: number;
  color: string;
  tint: string;
  textColor: string;
  barColor: string;
}

const LABEL_CLS = 'block text-[11px] font-semibold text-notion-steel mb-1.5 uppercase tracking-widest';
const INPUT_CLS = 'w-full rounded-notion-btn border border-notion-hairline-strong bg-notion-canvas px-3 py-2.5 text-sm text-notion-charcoal focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent transition-all';

const MOCK_BALANCE: LeaveBalance[] = [
  { id: 'b1', name: '연차', totalDays: 15, usedDays: 7, color: '#7C3AED', tint: 'bg-notion-tint-lavender border-violet-100', textColor: 'text-violet-700', barColor: 'bg-violet-500' },
  { id: 'b2', name: '반차', totalDays: 4, usedDays: 1, color: '#3B82F6', tint: 'bg-notion-tint-sky border-sky-100', textColor: 'text-sky-700', barColor: 'bg-sky-500' },
  { id: 'b3', name: '병가', totalDays: 6, usedDays: 1, color: '#10B981', tint: 'bg-notion-tint-mint border-emerald-100', textColor: 'text-emerald-700', barColor: 'bg-emerald-500' },
];

const MOCK_REQUESTS: LeaveRequest[] = [
  { id: 'r1', type: 'ANNUAL', startDate: '2026-04-16', endDate: '2026-04-18', days: 3, reason: '개인 사유', status: 'APPROVED' },
  { id: 'r2', type: 'HALF_AM', startDate: '2026-05-09', endDate: '2026-05-09', days: 0.5, reason: '병원 방문', status: 'APPROVED' },
  { id: 'r3', type: 'SICK', startDate: '2026-03-20', endDate: '2026-03-20', days: 1, reason: '감기', status: 'APPROVED' },
  { id: 'r4', type: 'ANNUAL', startDate: '2026-05-20', endDate: '2026-05-22', days: 3, reason: '가족 여행', status: 'PENDING' },
  { id: 'r5', type: 'HALF_PM', startDate: '2026-02-14', endDate: '2026-02-14', days: 0.5, reason: '', status: 'APPROVED' },
  { id: 'r6', type: 'OFFICIAL', startDate: '2026-01-15', endDate: '2026-01-15', days: 1, reason: '외부 세미나 참석', status: 'APPROVED' },
];

const TYPE_LABEL: Record<LeaveType, string> = {
  ANNUAL: '연차', HALF_AM: '오전 반차', HALF_PM: '오후 반차', SICK: '병가', OFFICIAL: '공가',
};
const STATUS_LABEL: Record<LeaveStatus, string> = { PENDING: '검토중', APPROVED: '승인', REJECTED: '반려' };

function uid() { return Math.random().toString(36).slice(2); }

export default function LeavePage() {
  const locale = 'ko-KR';
  const now = new Date();

  const [balance] = useState<LeaveBalance[]>(MOCK_BALANCE);
  const [requests, setRequests] = useState<LeaveRequest[]>(MOCK_REQUESTS);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'ANNUAL' as LeaveType, startDate: '', endDate: '', reason: '' });
  const [formError, setFormError] = useState('');

  const filteredRequests = useMemo(() =>
    requests.filter(r => new Date(r.startDate).getFullYear() === selectedYear)
      .sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [requests, selectedYear]
  );

  const historyByMonth = useMemo(() => {
    const map: Record<string, LeaveRequest[]> = {};
    filteredRequests.forEach(r => {
      const d = new Date(r.startDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return Object.fromEntries(Object.entries(map).sort(([a], [b]) => b.localeCompare(a)));
  }, [filteredRequests]);

  const isSingleDay = form.type === 'HALF_AM' || form.type === 'HALF_PM';
  const days = isSingleDay ? 0.5 : (form.startDate && form.endDate ? Math.max(1, Math.round((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / 86400000) + 1) : 0);

  function openForm() { setShowForm(true); setFormError(''); setForm({ type: 'ANNUAL', startDate: '', endDate: '', reason: '' }); }
  function closeForm() { setShowForm(false); setFormError(''); }

  function submitLeave() {
    if (!form.startDate) { setFormError('날짜를 선택해 주세요.'); return; }
    if (!isSingleDay && !form.endDate) { setFormError('종료일을 선택해 주세요.'); return; }
    const newReq: LeaveRequest = {
      id: uid(),
      type: form.type,
      startDate: form.startDate,
      endDate: isSingleDay ? form.startDate : form.endDate,
      days: isSingleDay ? 0.5 : days,
      reason: form.reason,
      status: 'PENDING',
    };
    setRequests(rs => [newReq, ...rs]);
    closeForm();
  }

  const statusBadge = (s: LeaveStatus) => {
    if (s === 'APPROVED') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100';
    if (s === 'REJECTED') return 'bg-rose-50 text-rose-700 ring-1 ring-rose-100';
    return 'bg-amber-50 text-amber-700 ring-1 ring-amber-100';
  };

  return (
    <div className="min-h-full bg-notion-surface p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-notion-charcoal tracking-tight">연차 관리</h1>
          <p className="mt-0.5 text-sm text-notion-steel">휴가 신청 및 잔여 연차를 확인하세요</p>
        </div>
        <button onClick={openForm}
          className="inline-flex items-center gap-2 rounded-notion-btn bg-violet-700 hover:bg-violet-800 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-200 transition-colors self-start sm:self-auto">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          휴가 신청
        </button>
      </div>

      {/* Balance cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {balance.map(b => {
          const remaining = b.totalDays - b.usedDays;
          const pct = b.totalDays > 0 ? Math.round((b.usedDays / b.totalDays) * 100) : 0;
          return (
            <div key={b.id} className={`rounded-notion-card border shadow-notion-subtle p-6 ${b.tint}`}>
              <div className="flex items-center justify-between mb-3">
                <p className={`text-sm font-semibold ${b.textColor}`}>{b.name}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.textColor} bg-white/70`}>총 {b.totalDays}일</span>
              </div>
              <p className={`text-4xl font-bold tabular-nums tracking-tight ${b.textColor} mb-0.5`}>
                {remaining}<span className="text-base font-normal ml-1 opacity-60">일</span>
              </p>
              <p className="text-xs opacity-60 mb-4 mt-0.5">사용 {b.usedDays}일 · 잔여 {remaining}일</p>
              <div className="w-full bg-white/50 rounded-full h-1.5 mb-1">
                <div className={`${b.barColor} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
              </div>
              <p className={`text-xs opacity-50`}>{pct}% 사용됨</p>
            </div>
          );
        })}
      </div>

      {/* History */}
      <div className="rounded-notion-card bg-notion-canvas border border-notion-hairline shadow-notion-subtle overflow-hidden">
        <div className="px-6 py-4 border-b border-notion-hairline flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-notion-charcoal tracking-tight">신청 내역</h2>
          <select value={selectedYear} onChange={e => setSelectedYear(+e.target.value)}
            className="rounded-notion-btn border border-notion-hairline-strong bg-notion-canvas px-3 py-1.5 text-sm text-notion-charcoal focus:outline-none focus:ring-2 focus:ring-violet-600">
            {[now.getFullYear() + 1, now.getFullYear(), now.getFullYear() - 1].map(y => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
        </div>

        {filteredRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-14 h-14 rounded-full bg-notion-tint-lavender flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-notion-steel">이 연도의 신청 내역이 없습니다</p>
          </div>
        ) : (
          <div className="divide-y divide-notion-hairline-soft">
            {Object.entries(historyByMonth).map(([monthKey, list]) => {
              const [y, m] = monthKey.split('-').map(Number);
              const monthLabel = new Date(y, m - 1).toLocaleDateString(locale, { year: 'numeric', month: 'long' });
              return (
                <div key={monthKey} className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-sm font-semibold text-notion-charcoal">{monthLabel}</h3>
                    <span className="rounded-full bg-notion-tint-lavender px-2.5 py-0.5 text-xs font-semibold text-violet-700">{list.length}건</span>
                  </div>

                  {/* Desktop */}
                  <div className="hidden md:block rounded-notion-btn overflow-hidden border border-notion-hairline">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-notion-surface border-b border-notion-hairline">
                          <th className="px-4 py-3 text-left text-[11px] font-semibold text-notion-steel uppercase tracking-widest">구분</th>
                          <th className="px-4 py-3 text-left text-[11px] font-semibold text-notion-steel uppercase tracking-widest">기간</th>
                          <th className="px-4 py-3 text-left text-[11px] font-semibold text-notion-steel uppercase tracking-widest">일수</th>
                          <th className="px-4 py-3 text-left text-[11px] font-semibold text-notion-steel uppercase tracking-widest">사유</th>
                          <th className="px-4 py-3 text-left text-[11px] font-semibold text-notion-steel uppercase tracking-widest">상태</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {list.map(r => (
                          <tr key={r.id} className="hover:bg-notion-surface transition-colors">
                            <td className="px-4 py-3 font-medium text-notion-charcoal">{TYPE_LABEL[r.type]}</td>
                            <td className="px-4 py-3 text-notion-slate whitespace-nowrap">
                              {r.startDate === r.endDate
                                ? new Date(r.startDate).toLocaleDateString(locale)
                                : `${new Date(r.startDate).toLocaleDateString(locale)} ~ ${new Date(r.endDate).toLocaleDateString(locale)}`}
                            </td>
                            <td className="px-4 py-3 text-notion-slate tabular-nums">{r.days}일</td>
                            <td className="px-4 py-3 text-notion-steel max-w-[180px] truncate">{r.reason || '—'}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(r.status)}`}>
                                {STATUS_LABEL[r.status]}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile */}
                  <div className="md:hidden space-y-2">
                    {list.map(r => (
                      <div key={r.id} className="rounded-notion-btn border border-notion-hairline p-4 bg-notion-surface/40">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className="font-semibold text-notion-charcoal text-sm">{TYPE_LABEL[r.type]}</span>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold shrink-0 ${statusBadge(r.status)}`}>{STATUS_LABEL[r.status]}</span>
                        </div>
                        <p className="text-xs text-notion-steel">
                          {r.startDate === r.endDate ? new Date(r.startDate).toLocaleDateString(locale) : `${new Date(r.startDate).toLocaleDateString(locale)} ~ ${new Date(r.endDate).toLocaleDateString(locale)}`}
                          {' · '}{r.days}일
                        </p>
                        {r.reason && <p className="text-xs text-notion-muted mt-1 line-clamp-1">{r.reason}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Form modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-notion-navy/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-notion-canvas rounded-notion-card p-6 w-full max-w-md shadow-notion-modal border border-notion-hairline my-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-notion-charcoal">휴가 신청</h3>
              <button onClick={closeForm} className="rounded-notion-btn p-1.5 text-notion-steel hover:bg-notion-surface transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Type */}
              <div>
                <label className={LABEL_CLS}>휴가 유형</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['ANNUAL', 'HALF_AM', 'HALF_PM', 'SICK', 'OFFICIAL'] as LeaveType[]).map(t => (
                    <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t, endDate: '' }))}
                      className={`py-2 text-xs font-semibold rounded-notion-btn border transition-colors ${form.type === t ? 'bg-violet-700 text-white border-violet-700' : 'border-notion-hairline-strong text-notion-slate hover:bg-notion-surface'}`}>
                      {TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date */}
              {isSingleDay ? (
                <div>
                  <label className={LABEL_CLS}>날짜</label>
                  <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value, endDate: e.target.value }))}
                    className={INPUT_CLS} min="2024-01-01" max="2027-12-31" />
                </div>
              ) : (
                <div>
                  <label className={LABEL_CLS}>기간</label>
                  <div className="flex items-center gap-2">
                    <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                      className={`${INPUT_CLS} flex-1`} min="2024-01-01" max="2027-12-31" />
                    <span className="text-notion-muted text-sm shrink-0">~</span>
                    <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                      className={`${INPUT_CLS} flex-1`} min={form.startDate || '2024-01-01'} max="2027-12-31" />
                  </div>
                  {form.startDate && form.endDate && (
                    <p className="text-xs text-notion-steel mt-1.5 px-1">
                      총 <span className="font-semibold text-violet-700">{days}일</span> (주말 포함)
                    </p>
                  )}
                </div>
              )}

              {/* Reason */}
              <div>
                <label className={LABEL_CLS}>
                  사유 <span className="text-notion-muted normal-case font-normal">(선택)</span>
                </label>
                <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  rows={3} placeholder="사유를 입력하세요" className={`${INPUT_CLS} resize-none`} />
              </div>
            </div>

            {formError && (
              <div className="mt-4 rounded-notion-btn bg-rose-50 border border-rose-100 p-3">
                <p className="text-sm text-rose-600">{formError}</p>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button onClick={closeForm}
                className="flex-1 rounded-notion-btn border border-notion-hairline-strong py-2.5 text-sm font-medium text-notion-slate hover:bg-notion-surface transition-colors">
                취소
              </button>
              <button onClick={submitLeave}
                className="flex-1 rounded-notion-btn bg-violet-700 hover:bg-violet-800 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-200 transition-colors">
                신청
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
