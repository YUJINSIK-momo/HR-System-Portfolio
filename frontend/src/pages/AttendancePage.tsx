import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuthStore } from '@/stores/authStore';
import { TimeSelectInput } from '@/components/TimeSelectInput';

type ConfirmType = 'check-in' | 'check-out' | null;
type WorkLocation = 'OFFICE' | 'OVERSEAS';
type CorrectionModal =
  | null
  | { mode: 'ADD' }
  | { mode: 'EDIT'; recordId: string; workDateStr: string; checkIn: string; checkOut: string };

function toTimeOnly(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function optionalLocalIso(dateStr: string, hhmm: string) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return undefined;
  return new Date(`${dateStr}T${hhmm}:00`).toISOString();
}

const INPUT_CLS = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

export default function AttendancePage() {
  const { t, lang } = useTranslation();
  const isForeignFreelancer = useAuthStore((s) => s.user?.role === 'FOREIGN_FREELANCER');
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<ConfirmType>(null);
  const [workLocation, setWorkLocation] = useState<WorkLocation>('OFFICE');
  const [correctionModal, setCorrectionModal] = useState<CorrectionModal>(null);
  const [addWorkDate, setAddWorkDate] = useState('');
  const [addWl, setAddWl] = useState<WorkLocation>('OFFICE');
  const [addIn, setAddIn] = useState('09:00');
  const [addOut, setAddOut] = useState('18:00');
  const [addReason, setAddReason] = useState('');
  const [editIn, setEditIn] = useState('09:00');
  const [editOut, setEditOut] = useState('18:00');
  const [editReason, setEditReason] = useState('');
  const [correctionErr, setCorrectionErr] = useState('');
  const queryClient = useQueryClient();

  const yesterdayStr = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); }, []);
  const [startDate, endDate] = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    return [new Date(y, m - 1, 1).toISOString().slice(0, 10), new Date(y, m, 0).toISOString().slice(0, 10)];
  }, [selectedMonth]);

  const { data: today } = useQuery({ queryKey: ['attendance', 'today'], queryFn: () => api.get('/attendance/me').then((r) => r.data) });
  const { data: history } = useQuery({ queryKey: ['attendance', 'history', startDate, endDate], queryFn: () => api.get('/attendance/history', { params: { startDate, endDate } }).then((r) => r.data) });
  const { data: myCorrections } = useQuery({ queryKey: ['attendance-corrections', 'me'], queryFn: () => api.get('/attendance-corrections/me').then((r) => r.data) });

  useEffect(() => {
    if (correctionModal?.mode === 'ADD') { setAddWorkDate(yesterdayStr); setAddWl('OFFICE'); setAddIn('09:00'); setAddOut('18:00'); setAddReason(''); setCorrectionErr(''); }
    else if (correctionModal?.mode === 'EDIT') { setEditIn(correctionModal.checkIn); setEditOut(correctionModal.checkOut); setEditReason(''); setCorrectionErr(''); }
  }, [correctionModal, yesterdayStr]);

  const createCorrection = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/attendance-corrections', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['attendance-corrections'] }); queryClient.invalidateQueries({ queryKey: ['attendance'] }); setCorrectionModal(null); },
    onError: (err: any) => setCorrectionErr(err.response?.data?.message || '신청 처리 중 오류가 발생했습니다.'),
  });
  const checkIn = useMutation({
    mutationFn: (location: WorkLocation) => api.post('/attendance/check-in', { workLocation: location }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['attendance'] }); setConfirm(null); },
    onError: (err: any) => { setError(err.response?.data?.message ?? (err.code === 'ERR_NETWORK' ? '서버에 연결할 수 없습니다.' : '출근 처리 중 오류가 발생했습니다.')); setConfirm(null); },
  });
  const checkOut = useMutation({
    mutationFn: () => api.post('/attendance/check-out'),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['attendance'] }); setConfirm(null); },
    onError: (err: any) => { setError(err.response?.data?.message || '퇴근 처리 중 오류가 발생했습니다.'); setConfirm(null); },
  });

  const handleConfirm = () => { if (confirm === 'check-in') checkIn.mutate(isForeignFreelancer ? 'OFFICE' : workLocation); else if (confirm === 'check-out') checkOut.mutate(); };
  const workLocationLabel = (wl: string | null | undefined) => wl === 'OVERSEAS' ? t('workOverseas') : t('workOffice');
  const attendanceStatusLabel = (r: { status?: string; workLocation?: string | null }) => {
    if (r.status === 'LATE') return r.workLocation === 'OVERSEAS' ? `${t('lateCheckIn')} (${t('workOverseas')})` : t('lateCheckIn');
    if (r.status === 'EARLY_LEAVE') return t('earlyLeave');
    if (r.status === 'ABSENT') return t('absent');
    if (r.status === 'ON_LEAVE') return t('onLeave');
    return workLocationLabel(r.workLocation);
  };

  const locale = lang === 'ja' ? 'ja-JP' : 'ko-KR';
  const currentTimeStr = new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(locale);

  const statusBadge = (r: { status?: string; workLocation?: string | null }) => {
    if (r.status === 'LATE') return 'bg-amber-50 text-amber-700 ring-1 ring-amber-100';
    if (r.workLocation === 'OVERSEAS') return 'bg-violet-50 text-violet-700 ring-1 ring-violet-100';
    return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100';
  };
  const corrStatusBadge = (s: string) => s === 'PENDING' ? 'bg-amber-50 text-amber-700' : s === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700';

  const checkedIn = !!today?.checkIn;
  const checkedOut = !!today?.checkOut;

  return (
    <div className="min-h-full bg-slate-50 p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">{t('attendance')}</h1>
        <p className="mt-1 text-sm text-slate-500">출퇴근 기록 및 근태 이력을 확인하세요</p>
      </div>

      {/* Confirm modal */}
      {confirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${confirm === 'check-in' ? 'bg-indigo-50' : 'bg-emerald-50'}`}>
              {confirm === 'check-in'
                ? <svg className="w-7 h-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                : <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>}
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">{confirm === 'check-in' ? t('todayCheckIn') : t('todayCheckOut')}</h3>
            <p className="text-slate-400 text-xs mb-1">현재 시각</p>
            <p className="text-3xl font-bold text-slate-900 mb-3 tabular-nums">{currentTimeStr}</p>
            <p className="text-sm text-slate-500 mb-6">{confirm === 'check-in' ? '지금 출근 처리하시겠습니까?' : '지금 퇴근 처리하시겠습니까?'}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600">{t('cancel')}</button>
              <button onClick={handleConfirm} disabled={checkIn.isPending || checkOut.isPending} className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white ${confirm === 'check-in' ? 'bg-gradient-to-r from-indigo-600 to-violet-600' : 'bg-gradient-to-r from-emerald-500 to-teal-600'} disabled:opacity-50`}>
                {checkIn.isPending || checkOut.isPending ? t('processing') : t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Correction modal */}
      {correctionModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-slate-900">{correctionModal.mode === 'ADD' ? t('attendanceCorrectionAddMissing') : t('attendanceCorrectionEditTimes')}</h3>
              <button onClick={() => setCorrectionModal(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            {correctionErr && <div className="mb-3 rounded-xl bg-rose-50 border border-rose-100 p-3"><p className="text-sm text-rose-600">{correctionErr}</p></div>}
            {correctionModal.mode === 'ADD' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">{t('attendanceCorrectionWorkDate')}</label>
                  <input type="date" value={addWorkDate} max={yesterdayStr} onChange={(e) => setAddWorkDate(e.target.value)} className={INPUT_CLS} />
                  <p className="text-xs text-slate-400 mt-1">당일은 출근/퇴근 버튼을 이용해 주세요.</p>
                </div>
                {!isForeignFreelancer && (
                  <div className="flex gap-2">
                    {(['OFFICE', 'OVERSEAS'] as WorkLocation[]).map((wl) => (
                      <button key={wl} type="button" onClick={() => setAddWl(wl)} className={`flex-1 rounded-xl py-2 text-sm font-medium border transition-colors ${addWl === wl ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        {wl === 'OFFICE' ? t('workOffice') : t('workOverseas')}
                      </button>
                    ))}
                  </div>
                )}
                <TimeSelectInput label={t('attendanceCorrectionProposedIn')} value={addIn} onChange={setAddIn} />
                <TimeSelectInput label={t('attendanceCorrectionProposedOut')} value={addOut} onChange={setAddOut} />
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">{t('attendanceCorrectionReason')}</label>
                  <textarea value={addReason} onChange={(e) => setAddReason(e.target.value)} rows={2} className={`${INPUT_CLS} resize-none`} />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setCorrectionModal(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600">{t('cancel')}</button>
                  <button type="button" disabled={createCorrection.isPending || !addWorkDate} onClick={() => { setCorrectionErr(''); createCorrection.mutate({ kind: 'ADD_MISSING', workDate: addWorkDate, proposedCheckIn: optionalLocalIso(addWorkDate, addIn) ?? null, proposedCheckOut: optionalLocalIso(addWorkDate, addOut) ?? null, workLocation: isForeignFreelancer ? 'OFFICE' : addWl, reason: addReason.trim() || undefined }); }} className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                    {createCorrection.isPending ? t('processing') : t('attendanceCorrectionSubmit')}
                  </button>
                </div>
              </div>
            )}
            {correctionModal.mode === 'EDIT' && (
              <div className="space-y-4">
                <p className="text-sm font-medium text-slate-600 bg-slate-50 rounded-xl px-3 py-2">{new Date(correctionModal.workDateStr).toLocaleDateString(locale)}</p>
                <TimeSelectInput label={t('attendanceCorrectionProposedIn')} value={editIn} onChange={setEditIn} />
                <TimeSelectInput label={t('attendanceCorrectionProposedOut')} value={editOut} onChange={setEditOut} />
                <p className="text-xs text-slate-400">바꾸지 않을 시각은 그대로 두면 기존 값이 유지됩니다.</p>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">{t('attendanceCorrectionReason')}</label>
                  <textarea value={editReason} onChange={(e) => setEditReason(e.target.value)} rows={2} className={`${INPUT_CLS} resize-none`} />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setCorrectionModal(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600">{t('cancel')}</button>
                  <button type="button" disabled={createCorrection.isPending} onClick={() => { setCorrectionErr(''); createCorrection.mutate({ kind: 'EDIT_TIMES', workDate: correctionModal.workDateStr, attendanceRecordId: correctionModal.recordId, proposedCheckIn: optionalLocalIso(correctionModal.workDateStr, editIn), proposedCheckOut: optionalLocalIso(correctionModal.workDateStr, editOut), reason: editReason.trim() || undefined }); }} className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                    {createCorrection.isPending ? t('processing') : t('attendanceCorrectionSubmit')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Today status card */}
      <div className="mb-6 rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-indigo-200 text-sm font-medium mb-1">오늘 근태</p>
              <p className="text-white text-2xl font-bold tabular-nums">{new Date().toLocaleDateString(locale, { month: 'long', day: 'numeric', weekday: 'short' })}</p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{t('todayCheckIn')}</p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{today?.checkIn ? formatTime(today.checkIn) : '—'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{t('todayCheckOut')}</p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">
                {today?.checkOut ? formatTime(today.checkOut) : today?.checkIn ? <span className="text-emerald-600 text-lg">근무 중</span> : '—'}
              </p>
            </div>
          </div>

          {!isForeignFreelancer && !checkedIn && (
            <div className="mb-5 flex gap-2">
              {(['OFFICE', 'OVERSEAS'] as WorkLocation[]).map((wl) => (
                <button key={wl} type="button" onClick={() => setWorkLocation(wl)} className={`flex-1 rounded-xl py-2 text-sm font-medium border transition-colors ${workLocation === wl ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {wl === 'OFFICE' ? t('workOffice') : t('workOverseas')}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => { setError(''); setConfirm('check-in'); }} disabled={checkedIn} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-200 hover:opacity-90 transition-opacity disabled:opacity-30 disabled:shadow-none">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
              {t('todayCheckIn')}
            </button>
            <button onClick={() => { setError(''); setConfirm('check-out'); }} disabled={!checkedIn || checkedOut} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-200 hover:opacity-90 transition-opacity disabled:opacity-30 disabled:shadow-none">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              {t('todayCheckOut')}
            </button>
          </div>
          {error && <div className="mt-3 rounded-xl bg-rose-50 border border-rose-100 p-3"><p className="text-sm text-rose-600">{error}</p></div>}
        </div>
      </div>

      {/* Correction requests */}
      <div className="mb-6 rounded-2xl bg-white border border-slate-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">{t('attendanceCorrectionSection')}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{t('attendanceCorrectionMyRequests')}</p>
          </div>
          <button type="button" onClick={() => setCorrectionModal({ mode: 'ADD' })} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            {t('attendanceCorrectionOpenForm')}
          </button>
        </div>
        {myCorrections && myCorrections.length > 0 ? (
          <div className="rounded-xl overflow-hidden border border-slate-100">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{t('date')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">구분</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{t('status')}</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {myCorrections.slice(0, 15).map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 text-slate-700 tabular-nums">{new Date(c.workDate).toLocaleDateString(locale)}</td>
                    <td className="px-4 py-3 text-slate-600">{c.kind === 'ADD_MISSING' ? t('attendanceCorrectionAddMissing') : t('attendanceCorrectionEditTimes')}</td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${corrStatusBadge(c.status)}`}>{c.status === 'PENDING' ? t('pending') : c.status === 'APPROVED' ? t('approved') : t('rejected')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-slate-400">신청 내역이 없습니다.</p>
          </div>
        )}
      </div>

      {/* History */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">근태 이력</h2>
          <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-36" />
        </div>
        {/* Desktop */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50">
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{t('date')}</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{t('todayCheckIn')}</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{t('todayCheckOut')}</th>
              {!isForeignFreelancer && <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{t('status')}</th>}
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{t('action')}</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-50">
              {history?.map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-3 font-medium text-slate-800">{formatDate(r.date)}</td>
                  <td className="px-6 py-3 text-slate-600 tabular-nums">{r.checkIn ? formatTime(r.checkIn) : '—'}</td>
                  <td className="px-6 py-3 text-slate-600 tabular-nums">{r.checkOut ? formatTime(r.checkOut) : '—'}</td>
                  {!isForeignFreelancer && (
                    <td className="px-6 py-3"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(r)}`}>{attendanceStatusLabel(r)}</span></td>
                  )}
                  <td className="px-6 py-3">
                    <button type="button" onClick={() => setCorrectionModal({ mode: 'EDIT', recordId: r.id, workDateStr: new Date(r.date).toISOString().slice(0, 10), checkIn: r.checkIn ? toTimeOnly(r.checkIn) : '09:00', checkOut: r.checkOut ? toTimeOnly(r.checkOut) : '18:00' })} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
                      {t('attendanceCorrectionRequestEditRow')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile */}
        <div className="sm:hidden divide-y divide-slate-50">
          {history?.map((r: any) => (
            <div key={r.id} className="p-4">
              <div className="flex justify-between items-start mb-2">
                <span className="font-semibold text-slate-800">{formatDate(r.date)}</span>
                {!isForeignFreelancer && <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(r)}`}>{attendanceStatusLabel(r)}</span>}
              </div>
              <div className="flex gap-4 text-sm text-slate-500 mb-2">
                <span>출근 {r.checkIn ? formatTime(r.checkIn) : '—'}</span>
                <span>퇴근 {r.checkOut ? formatTime(r.checkOut) : '—'}</span>
              </div>
              <button type="button" onClick={() => setCorrectionModal({ mode: 'EDIT', recordId: r.id, workDateStr: new Date(r.date).toISOString().slice(0, 10), checkIn: r.checkIn ? toTimeOnly(r.checkIn) : '09:00', checkOut: r.checkOut ? toTimeOnly(r.checkOut) : '18:00' })} className="text-xs font-semibold text-indigo-600">
                {t('attendanceCorrectionRequestEditRow')}
              </button>
            </div>
          ))}
        </div>
        {(!history || history.length === 0) && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 mb-4">
              <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
            </div>
            <p className="text-sm text-slate-400">{t('noRecords')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
