import { useState, useMemo, useEffect } from 'react';

type WorkLocation = 'OFFICE' | 'OVERSEAS';
type ConfirmType = 'check-in' | 'check-out' | null;
type CorrectionModal =
  | null
  | { mode: 'ADD' }
  | { mode: 'EDIT'; recordId: string; workDateStr: string; checkIn: string; checkOut: string };

const INPUT_CLS = 'w-full rounded-notion-btn border border-notion-hairline-strong bg-notion-canvas px-3 py-2 text-sm text-notion-charcoal focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent transition-all';
const LABEL_CLS = 'block text-[11px] font-semibold text-notion-steel mb-1.5 uppercase tracking-widest';

interface AttRecord { id: string; date: string; checkIn: string | null; checkOut: string | null; status: string; workLocation: string | null; }
interface Correction { id: string; workDate: string; kind: string; status: string; }

const MOCK_HISTORY: AttRecord[] = [
  { id: 'h1', date: '2026-05-13T00:00:00Z', checkIn: '2026-05-13T09:03:00Z', checkOut: null, status: 'NORMAL', workLocation: 'OFFICE' },
  { id: 'h2', date: '2026-05-12T00:00:00Z', checkIn: '2026-05-12T09:18:00Z', checkOut: '2026-05-12T18:30:00Z', status: 'LATE', workLocation: 'OFFICE' },
  { id: 'h3', date: '2026-05-11T00:00:00Z', checkIn: '2026-05-11T09:02:00Z', checkOut: '2026-05-11T18:10:00Z', status: 'NORMAL', workLocation: 'OFFICE' },
  { id: 'h4', date: '2026-05-09T00:00:00Z', checkIn: '2026-05-09T09:00:00Z', checkOut: '2026-05-09T17:55:00Z', status: 'NORMAL', workLocation: 'OVERSEAS' },
  { id: 'h5', date: '2026-05-08T00:00:00Z', checkIn: '2026-05-08T09:05:00Z', checkOut: '2026-05-08T18:45:00Z', status: 'NORMAL', workLocation: 'OFFICE' },
  { id: 'h6', date: '2026-05-07T00:00:00Z', checkIn: null, checkOut: null, status: 'ON_LEAVE', workLocation: null },
  { id: 'h7', date: '2026-05-02T00:00:00Z', checkIn: '2026-05-02T09:01:00Z', checkOut: '2026-05-02T18:00:00Z', status: 'NORMAL', workLocation: 'OFFICE' },
  { id: 'h8', date: '2026-04-30T00:00:00Z', checkIn: '2026-04-30T09:04:00Z', checkOut: '2026-04-30T18:30:00Z', status: 'NORMAL', workLocation: 'OFFICE' },
  { id: 'h9', date: '2026-04-29T00:00:00Z', checkIn: '2026-04-29T09:22:00Z', checkOut: '2026-04-29T18:15:00Z', status: 'LATE', workLocation: 'OFFICE' },
  { id: 'h10', date: '2026-04-28T00:00:00Z', checkIn: '2026-04-28T09:00:00Z', checkOut: '2026-04-28T18:00:00Z', status: 'NORMAL', workLocation: 'OFFICE' },
  { id: 'h11', date: '2026-04-25T00:00:00Z', checkIn: '2026-04-25T09:01:00Z', checkOut: '2026-04-25T18:10:00Z', status: 'NORMAL', workLocation: 'OFFICE' },
  { id: 'h12', date: '2026-04-24T00:00:00Z', checkIn: '2026-04-24T09:00:00Z', checkOut: '2026-04-24T17:58:00Z', status: 'NORMAL', workLocation: 'OFFICE' },
];

const MOCK_CORRECTIONS: Correction[] = [
  { id: 'c1', workDate: '2026-04-25T00:00:00Z', kind: 'EDIT_TIMES', status: 'APPROVED' },
  { id: 'c2', workDate: '2026-05-08T00:00:00Z', kind: 'ADD_MISSING', status: 'PENDING' },
];

function toTimeOnly(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function AttendancePage() {
  const now = new Date();
  const locale = 'ko-KR';
  const [todayCheckIn, setTodayCheckIn] = useState<string | null>('2026-05-13T09:03:00.000Z');
  const [todayCheckOut, setTodayCheckOut] = useState<string | null>(null);
  const [workLocation, setWorkLocation] = useState<WorkLocation>('OFFICE');
  const [confirm, setConfirm] = useState<ConfirmType>(null);
  const [error, setError] = useState('');

  const [history] = useState<AttRecord[]>(MOCK_HISTORY);
  const [selectedMonth, setSelectedMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

  const [corrections, setCorrections] = useState<Correction[]>(MOCK_CORRECTIONS);
  const [correctionModal, setCorrectionModal] = useState<CorrectionModal>(null);
  const [addWorkDate, setAddWorkDate] = useState('');
  const [addWl, setAddWl] = useState<WorkLocation>('OFFICE');
  const [addIn, setAddIn] = useState('09:00');
  const [addOut, setAddOut] = useState('18:00');
  const [addReason, setAddReason] = useState('');
  const [editIn, setEditIn] = useState('09:00');
  const [editOut, setEditOut] = useState('18:00');

  const yesterdayStr = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); }, []);

  const [startDate, endDate] = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    return [new Date(y, m - 1, 1).toISOString().slice(0, 10), new Date(y, m, 0).toISOString().slice(0, 10)];
  }, [selectedMonth]);

  const filteredHistory = useMemo(() =>
    history.filter(r => {
      const d = new Date(r.date).toISOString().slice(0, 10);
      return d >= startDate && d <= endDate;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [history, startDate, endDate]
  );

  const monthlySummary = useMemo(() => ({
    present: filteredHistory.filter(r => r.checkIn).length,
    late: filteredHistory.filter(r => r.status === 'LATE').length,
    leave: filteredHistory.filter(r => r.status === 'ON_LEAVE').length,
    absent: filteredHistory.filter(r => r.status === 'ABSENT').length,
  }), [filteredHistory]);

  useEffect(() => {
    if (correctionModal?.mode === 'ADD') { setAddWorkDate(yesterdayStr); setAddWl('OFFICE'); setAddIn('09:00'); setAddOut('18:00'); setAddReason(''); }
    else if (correctionModal?.mode === 'EDIT') { setEditIn(correctionModal.checkIn); setEditOut(correctionModal.checkOut); }
  }, [correctionModal, yesterdayStr]);

  const checkedIn = !!todayCheckIn;
  const checkedOut = !!todayCheckOut;
  const currentTimeStr = new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric', weekday: 'short' });

  const handleConfirm = () => {
    const ts = new Date().toISOString();
    if (confirm === 'check-in') { setTodayCheckIn(ts); setError(''); }
    else if (confirm === 'check-out') { setTodayCheckOut(ts); setError(''); }
    setConfirm(null);
  };

  function submitCorrection() {
    const wDate = correctionModal?.mode === 'ADD' ? addWorkDate : (correctionModal as any)?.workDateStr || '';
    setCorrections(cs => [{ id: `c-${Date.now()}`, workDate: `${wDate}T00:00:00Z`, kind: correctionModal?.mode === 'ADD' ? 'ADD_MISSING' : 'EDIT_TIMES', status: 'PENDING' }, ...cs]);
    setCorrectionModal(null);
  }

  const statusBadge = (r: { status?: string; workLocation?: string | null }) => {
    if (r.status === 'LATE') return 'bg-amber-50 text-amber-700 ring-1 ring-amber-100';
    if (r.status === 'ABSENT') return 'bg-rose-50 text-rose-700 ring-1 ring-rose-100';
    if (r.status === 'ON_LEAVE') return 'bg-teal-50 text-teal-700 ring-1 ring-teal-100';
    if (r.workLocation === 'OVERSEAS') return 'bg-violet-50 text-violet-700 ring-1 ring-violet-100';
    return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100';
  };
  const statusLabel = (r: { status?: string; workLocation?: string | null }) => {
    if (r.status === 'LATE') return r.workLocation === 'OVERSEAS' ? '지각 (해외근무)' : '지각 출근';
    if (r.status === 'ABSENT') return '결근';
    if (r.status === 'ON_LEAVE') return '휴가';
    return r.workLocation === 'OVERSEAS' ? '해외근무' : '정상 출근';
  };
  const corrStatusBadge = (s: string) =>
    s === 'PENDING' ? 'bg-amber-50 text-amber-700' : s === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700';

  return (
    <div className="min-h-full bg-notion-surface p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-notion-charcoal tracking-tight">근태 관리</h1>
        <p className="mt-0.5 text-sm text-notion-steel">출퇴근 기록 및 근태 이력을 확인하세요</p>
      </div>

      {/* ── Confirm modal ── */}
      {confirm && (
        <div className="fixed inset-0 bg-notion-navy/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-notion-canvas rounded-notion-card p-6 w-full max-w-sm shadow-notion-modal border border-notion-hairline text-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${confirm === 'check-in' ? 'bg-notion-tint-sky' : 'bg-notion-tint-mint'}`}>
              {confirm === 'check-in'
                ? <svg className="w-6 h-6 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                : <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>}
            </div>
            <h3 className="text-base font-semibold text-notion-charcoal mb-1">{confirm === 'check-in' ? '출근 처리' : '퇴근 처리'}</h3>
            <p className="text-notion-steel text-xs mb-1">현재 시각</p>
            <p className="text-3xl font-bold text-notion-charcoal mb-3 tabular-nums tracking-tight">{currentTimeStr}</p>
            <p className="text-sm text-notion-slate mb-5">{confirm === 'check-in' ? '지금 출근 처리하시겠습니까?' : '지금 퇴근 처리하시겠습니까?'}</p>
            <div className="flex gap-2.5">
              <button onClick={() => setConfirm(null)} className="flex-1 rounded-notion-btn border border-notion-hairline-strong py-2.5 text-sm font-medium text-notion-slate hover:bg-notion-surface transition-colors">취소</button>
              <button onClick={handleConfirm} className={`flex-1 rounded-notion-btn py-2.5 text-sm font-semibold text-white transition-colors ${confirm === 'check-in' ? 'bg-violet-700 hover:bg-violet-800' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Correction modal ── */}
      {correctionModal && (
        <div className="fixed inset-0 bg-notion-navy/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-notion-canvas rounded-notion-card p-6 w-full max-w-md shadow-notion-modal border border-notion-hairline max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-notion-charcoal">{correctionModal.mode === 'ADD' ? '누락 출근 추가' : '시간 수정 신청'}</h3>
              <button onClick={() => setCorrectionModal(null)} className="rounded-notion-btn p-1.5 text-notion-steel hover:bg-notion-surface transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {correctionModal.mode === 'ADD' && (
              <div className="space-y-4">
                <div>
                  <label className={LABEL_CLS}>근무 일자</label>
                  <input type="date" value={addWorkDate} max={yesterdayStr} onChange={e => setAddWorkDate(e.target.value)} className={INPUT_CLS} />
                  <p className="text-xs text-notion-muted mt-1">당일은 출근/퇴근 버튼을 이용해 주세요.</p>
                </div>
                <div className="flex gap-2">
                  {(['OFFICE', 'OVERSEAS'] as WorkLocation[]).map(wl => (
                    <button key={wl} type="button" onClick={() => setAddWl(wl)}
                      className={`flex-1 rounded-notion-btn py-2 text-sm font-medium border transition-colors ${addWl === wl ? 'bg-violet-700 text-white border-violet-700' : 'border-notion-hairline-strong text-notion-slate hover:bg-notion-surface'}`}>
                      {wl === 'OFFICE' ? '사무실' : '해외근무'}
                    </button>
                  ))}
                </div>
                <div>
                  <label className={LABEL_CLS}>출근 시간</label>
                  <input type="time" value={addIn} onChange={e => setAddIn(e.target.value)} className={INPUT_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>퇴근 시간</label>
                  <input type="time" value={addOut} onChange={e => setAddOut(e.target.value)} className={INPUT_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>사유</label>
                  <textarea value={addReason} onChange={e => setAddReason(e.target.value)} rows={2} className={`${INPUT_CLS} resize-none`} placeholder="정정 사유를 입력하세요" />
                </div>
              </div>
            )}

            {correctionModal.mode === 'EDIT' && (
              <div className="space-y-4">
                <p className="text-sm font-medium text-notion-slate bg-notion-surface rounded-notion-btn px-3 py-2 border border-notion-hairline">
                  {new Date(correctionModal.workDateStr).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <div>
                  <label className={LABEL_CLS}>수정 출근 시간</label>
                  <input type="time" value={editIn} onChange={e => setEditIn(e.target.value)} className={INPUT_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>수정 퇴근 시간</label>
                  <input type="time" value={editOut} onChange={e => setEditOut(e.target.value)} className={INPUT_CLS} />
                </div>
                <p className="text-xs text-notion-muted">바꾸지 않을 시각은 그대로 두면 기존 값이 유지됩니다.</p>
              </div>
            )}

            <div className="flex gap-2.5 mt-6">
              <button onClick={() => setCorrectionModal(null)} className="flex-1 rounded-notion-btn border border-notion-hairline-strong py-2.5 text-sm font-medium text-notion-slate hover:bg-notion-surface transition-colors">취소</button>
              <button onClick={submitCorrection} disabled={correctionModal.mode === 'ADD' && !addWorkDate}
                className="flex-1 rounded-notion-btn bg-violet-700 hover:bg-violet-800 py-2.5 text-sm font-semibold text-white disabled:opacity-40 transition-colors">
                신청
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Today card ── */}
      <div className="mb-5 rounded-notion-card bg-notion-canvas border border-notion-hairline shadow-notion-subtle overflow-hidden">
        <div className="bg-notion-navy px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/50 text-xs font-medium mb-0.5 tracking-wide">오늘 근태</p>
              <p className="text-white text-lg font-semibold tracking-tight">
                {now.toLocaleDateString(locale, { month: 'long', day: 'numeric', weekday: 'short' })}
              </p>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-notion-btn text-xs font-semibold ${checkedIn && !checkedOut ? 'bg-emerald-500/20 text-emerald-300' : checkedOut ? 'bg-white/10 text-white/50' : 'bg-white/10 text-white/50'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${checkedIn && !checkedOut ? 'bg-emerald-400 animate-pulse' : 'bg-white/30'}`} />
              {checkedIn && !checkedOut ? '근무 중' : checkedOut ? '퇴근 완료' : '출근 전'}
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="rounded-notion-btn bg-notion-tint-sky border border-sky-100 p-4">
              <p className="text-[11px] font-semibold text-sky-600 uppercase tracking-widest mb-1">출근</p>
              <p className="text-2xl font-bold text-sky-700 tabular-nums tracking-tight">
                {todayCheckIn ? formatTime(todayCheckIn) : '—'}
              </p>
            </div>
            <div className="rounded-notion-btn bg-notion-tint-mint border border-emerald-100 p-4">
              <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-widest mb-1">퇴근</p>
              <p className="text-2xl font-bold text-emerald-700 tabular-nums tracking-tight">
                {todayCheckOut ? formatTime(todayCheckOut) : checkedIn ? <span className="text-base text-emerald-500">근무 중</span> : '—'}
              </p>
            </div>
          </div>

          {!checkedIn && (
            <div className="mb-4 flex gap-2">
              {(['OFFICE', 'OVERSEAS'] as WorkLocation[]).map(wl => (
                <button key={wl} type="button" onClick={() => setWorkLocation(wl)}
                  className={`flex-1 rounded-notion-btn py-2 text-sm font-medium border transition-colors ${workLocation === wl ? 'bg-violet-700 text-white border-violet-700' : 'border-notion-hairline-strong text-notion-slate hover:bg-notion-surface'}`}>
                  {wl === 'OFFICE' ? '사무실 출근' : '해외 출장'}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { setError(''); setConfirm('check-in'); }}
              disabled={checkedIn}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-notion-btn bg-violet-700 hover:bg-violet-800 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-30"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
              출근
            </button>
            <button
              onClick={() => { setError(''); setConfirm('check-out'); }}
              disabled={!checkedIn || checkedOut}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-notion-btn bg-emerald-600 hover:bg-emerald-700 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-30"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              퇴근
            </button>
          </div>
          {error && <div className="mt-3 rounded-notion-btn bg-rose-50 border border-rose-100 p-3"><p className="text-sm text-rose-600">{error}</p></div>}
        </div>
      </div>

      {/* ── Correction section ── */}
      <div className="mb-5 rounded-notion-card bg-notion-canvas border border-notion-hairline shadow-notion-subtle p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[15px] font-semibold text-notion-charcoal tracking-tight">근태 정정 신청</h2>
            <p className="text-xs text-notion-steel mt-0.5">누락·오기재된 출퇴근 시간을 수정 요청할 수 있습니다</p>
          </div>
          <button type="button" onClick={() => setCorrectionModal({ mode: 'ADD' })}
            className="inline-flex items-center gap-1.5 rounded-notion-btn border border-notion-hairline-strong px-3 py-2 text-sm font-medium text-notion-charcoal hover:bg-notion-surface transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            정정 신청
          </button>
        </div>

        {corrections.length > 0 ? (
          <div className="rounded-notion-btn overflow-hidden border border-notion-hairline">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-notion-surface border-b border-notion-hairline">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-notion-steel uppercase tracking-widest">날짜</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-notion-steel uppercase tracking-widest">구분</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-notion-steel uppercase tracking-widest">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-notion-hairline-soft">
                {corrections.map(c => (
                  <tr key={c.id} className="hover:bg-notion-surface transition-colors">
                    <td className="px-4 py-3 text-notion-charcoal tabular-nums text-sm">
                      {new Date(c.workDate).toLocaleDateString(locale)}
                    </td>
                    <td className="px-4 py-3 text-notion-slate text-sm">
                      {c.kind === 'ADD_MISSING' ? '누락 추가' : '시간 수정'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${corrStatusBadge(c.status)}`}>
                        {c.status === 'PENDING' ? '검토중' : c.status === 'APPROVED' ? '승인' : '반려'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-notion-steel">신청 내역이 없습니다.</p>
          </div>
        )}
      </div>

      {/* ── History ── */}
      <div className="rounded-notion-card bg-notion-canvas border border-notion-hairline shadow-notion-subtle overflow-hidden">
        <div className="px-5 py-4 border-b border-notion-hairline flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-notion-charcoal tracking-tight">근태 이력</h2>
          <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            className="rounded-notion-btn border border-notion-hairline-strong bg-notion-canvas px-3 py-1.5 text-sm text-notion-charcoal focus:outline-none focus:ring-2 focus:ring-violet-600 w-36" />
        </div>

        {/* Monthly summary chips */}
        {filteredHistory.length > 0 && (
          <div className="px-5 py-3 border-b border-notion-hairline-soft flex items-center gap-3 flex-wrap bg-notion-surface/50">
            <span className="text-xs text-notion-steel font-medium">이달 요약</span>
            <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold ring-1 ring-emerald-100">출근 {monthlySummary.present}일</span>
            {monthlySummary.late > 0 && <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold ring-1 ring-amber-100">지각 {monthlySummary.late}회</span>}
            {monthlySummary.leave > 0 && <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 font-semibold ring-1 ring-teal-100">휴가 {monthlySummary.leave}일</span>}
            {monthlySummary.absent > 0 && <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 font-semibold ring-1 ring-rose-100">결근 {monthlySummary.absent}일</span>}
          </div>
        )}

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-notion-surface border-b border-notion-hairline">
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-notion-steel uppercase tracking-widest">날짜</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-notion-steel uppercase tracking-widest">출근</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-notion-steel uppercase tracking-widest">퇴근</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-notion-steel uppercase tracking-widest">상태</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-notion-steel uppercase tracking-widest">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-notion-hairline-soft">
              {filteredHistory.map(r => (
                <tr key={r.id} className="hover:bg-notion-surface transition-colors">
                  <td className="px-5 py-3 font-medium text-notion-charcoal">{formatDate(r.date)}</td>
                  <td className="px-5 py-3 text-notion-slate tabular-nums">{r.checkIn ? formatTime(r.checkIn) : '—'}</td>
                  <td className="px-5 py-3 text-notion-slate tabular-nums">{r.checkOut ? formatTime(r.checkOut) : '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(r)}`}>{statusLabel(r)}</span>
                  </td>
                  <td className="px-5 py-3">
                    <button type="button" onClick={() => setCorrectionModal({ mode: 'EDIT', recordId: r.id, workDateStr: new Date(r.date).toISOString().slice(0, 10), checkIn: r.checkIn ? toTimeOnly(r.checkIn) : '09:00', checkOut: r.checkOut ? toTimeOnly(r.checkOut) : '18:00' })}
                      className="text-xs font-semibold text-violet-700 hover:text-violet-900 transition-colors">
                      수정 신청
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden divide-y divide-notion-hairline-soft">
          {filteredHistory.map(r => (
            <div key={r.id} className="p-4">
              <div className="flex justify-between items-start mb-2">
                <span className="font-semibold text-notion-charcoal text-sm">{formatDate(r.date)}</span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(r)}`}>{statusLabel(r)}</span>
              </div>
              <div className="flex gap-4 text-sm text-notion-slate mb-2">
                <span>출근 {r.checkIn ? formatTime(r.checkIn) : '—'}</span>
                <span>퇴근 {r.checkOut ? formatTime(r.checkOut) : '—'}</span>
              </div>
              <button type="button" onClick={() => setCorrectionModal({ mode: 'EDIT', recordId: r.id, workDateStr: new Date(r.date).toISOString().slice(0, 10), checkIn: r.checkIn ? toTimeOnly(r.checkIn) : '09:00', checkOut: r.checkOut ? toTimeOnly(r.checkOut) : '18:00' })}
                className="text-xs font-semibold text-violet-700">
                수정 신청
              </button>
            </div>
          ))}
        </div>

        {filteredHistory.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-notion-surface border border-notion-hairline mb-3">
              <svg className="w-6 h-6 text-notion-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-sm text-notion-steel">이 달의 기록이 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
