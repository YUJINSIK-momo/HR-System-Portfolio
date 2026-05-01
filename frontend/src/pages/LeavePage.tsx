import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import {
  FAMILY_LEAVE_SUBTYPES,
  FAMILY_LEAVE_BUSINESS_DAYS,
  computeFamilyLeaveEndLocal,
  type FamilyLeaveSubType,
} from '@/lib/familyLeave';
import { leaveTypeDisplay as formatLeaveType } from '@/lib/leaveTypeDisplay';
import type { TranslationKey } from '@/lib/translations';

type LeaveTypeValue = 'ANNUAL' | 'HALF_DAY_AM' | 'HALF_DAY_PM' | 'QUARTER_DAY' | 'SICK' | 'OFFICIAL' | 'FAMILY';
const defaultForm: {
  type: LeaveTypeValue;
  startDate: string;
  endDate: string;
  reason: string;
  quarterDays: number;
  familySubType: FamilyLeaveSubType | '';
} = { type: 'ANNUAL', startDate: '', endDate: '', reason: '', quarterDays: 0.25, familySubType: '' };

const LABEL_CLS = 'block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide';
const INPUT_CLS = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';


export default function LeavePage() {
  const { t, lang } = useTranslation();
  const locale = lang === 'ja' ? 'ja-JP' : 'ko-KR';
  const statusLabel: Record<string, string> = { PENDING: t('pending'), APPROVED: t('approved'), REJECTED: t('rejected') };
  const typeLabel: Record<string, string> = {
    ANNUAL: t('annual'), HALF_DAY_AM: t('halfDayAm'), HALF_DAY_PM: t('halfDayPm'),
    QUARTER_DAY: t('quarterDay'), SICK: t('sick'), OFFICIAL: t('official'), FAMILY: t('family'),
  };
  const leaveTypeDisplay = (r: { type: string; familySubType?: string | null }) => formatLeaveType(r, t, typeLabel);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const queryClient = useQueryClient();

  const { data: balances } = useQuery({
    queryKey: ['leave', 'balance'],
    queryFn: () => api.get('/leave/balance').then((r) => r.data),
  });
  const balanceRows = useMemo(() => {
    if (!Array.isArray(balances)) return [];
    return balances.filter((b: unknown): b is Record<string, unknown> => b != null && typeof b === 'object');
  }, [balances]);

  const { data: requests } = useQuery({
    queryKey: ['leave', 'requests'],
    queryFn: () => api.get('/leave/requests').then((r) => r.data),
  });
  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    return requests.filter((r: any) => new Date(r.startDate).getFullYear() === selectedYear);
  }, [requests, selectedYear]);
  const historyByMonth = useMemo(() => {
    const map: Record<string, typeof filteredRequests> = {};
    filteredRequests.forEach((r: any) => {
      const d = new Date(r.startDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return Object.fromEntries(Object.entries(map).sort(([a], [b]) => b.localeCompare(a)));
  }, [filteredRequests]);

  const submitLeave = useMutation({
    mutationFn: (data: { type: string; startDate?: string; endDate?: string; days?: number; reason?: string; familySubType?: string }) =>
      api.post('/leave/request', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave'] });
      setShowForm(false); setForm(defaultForm); setError('');
    },
    onError: (err: any) => setError(err.response?.data?.message || '신청 중 오류가 발생했습니다.'),
  });

  const isHalfDay = form.type === 'HALF_DAY_AM' || form.type === 'HALF_DAY_PM';
  const isQuarterDay = form.type === 'QUARTER_DAY';
  const isFamily = form.type === 'FAMILY';
  const isSingleDay = isHalfDay || isQuarterDay;

  const familyEndPreview = useMemo(() => {
    if (!isFamily || !form.startDate || !form.familySubType) return null;
    const start = new Date(form.startDate + 'T00:00:00');
    return computeFamilyLeaveEndLocal(start, FAMILY_LEAVE_BUSINESS_DAYS[form.familySubType as FamilyLeaveSubType], new Set());
  }, [isFamily, form.startDate, form.familySubType]);

  const handleTypeChange = (newType: LeaveTypeValue) => {
    const single = newType === 'HALF_DAY_AM' || newType === 'HALF_DAY_PM' || newType === 'QUARTER_DAY';
    const family = newType === 'FAMILY';
    setForm({
      ...form,
      type: newType,
      endDate: single ? form.startDate : '',
      familySubType: family ? (form.familySubType || 'OWN_MARRIAGE') : '',
      reason: family ? '' : form.reason,
    });
  };

  const handleOpenForm = () => { setShowForm(true); setError(''); setForm(defaultForm); };
  const closeForm = () => { setShowForm(false); setError(''); setForm(defaultForm); };

  const statusBadge = (status: string) => {
    if (status === 'APPROVED') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100';
    if (status === 'REJECTED') return 'bg-rose-50 text-rose-700 ring-1 ring-rose-100';
    return 'bg-amber-50 text-amber-700 ring-1 ring-amber-100';
  };

  const canSubmit = (() => {
    if (submitLeave.isPending) return false;
    if (!form.startDate) return false;
    if (isFamily) return !!form.familySubType;
    if (isSingleDay) return true;
    return !!form.endDate;
  })();

  return (
    <div className="min-h-full bg-slate-50 p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('leave')}</h1>
          <p className="mt-1 text-sm text-slate-500">휴가 신청 및 잔여 연차를 확인하세요</p>
        </div>
        <button
          onClick={handleOpenForm}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 hover:opacity-90 transition-opacity self-start sm:self-auto"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('leaveRequest')}
        </button>
      </div>

      {/* Balance cards */}
      {balanceRows.length > 0 && (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {balanceRows.map((b: any, i: number) => {
            const remaining = b.totalDays - b.usedDays;
            const pct = b.totalDays > 0 ? Math.round((b.usedDays / b.totalDays) * 100) : 0;
            const gradients = [
              'from-indigo-500 to-violet-600 shadow-indigo-200',
              'from-emerald-500 to-teal-600 shadow-emerald-200',
              'from-amber-500 to-orange-500 shadow-amber-200',
            ];
            const barColors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500'];
            return (
              <div key={b?.id ?? `leave-balance-${i}`} className="rounded-2xl bg-white border border-slate-100 shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${gradients[i % gradients.length]} shadow-md`}>
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-600">{b?.policy?.name ?? t('leaveBalance')}</p>
                </div>
                <p className="text-4xl font-bold text-slate-900 mb-0.5">
                  {remaining}<span className="text-base font-normal text-slate-400 ml-1">{t('days')}</span>
                </p>
                <p className="text-xs text-slate-400 mb-4">총 {b.totalDays}일 · 사용 {b.usedDays}일</p>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mb-1">
                  <div className={`${barColors[i % barColors.length]} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-slate-400">{pct}% 사용됨</p>
              </div>
            );
          })}
        </div>
      )}

      {/* History */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">{t('leaveHistory')}</h2>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {[new Date().getFullYear() + 1, new Date().getFullYear(), new Date().getFullYear() - 1].map((y) => (
              <option key={y} value={y}>{y}{t('year')}</option>
            ))}
          </select>
        </div>

        {filteredRequests.length === 0 || !requests ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 mb-4">
              <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-400">{t('noLeaveHistory')}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {Object.entries(historyByMonth).map(([monthKey, list]) => {
              const [y, m] = monthKey.split('-').map(Number);
              const monthLabel = new Date(y, m - 1).toLocaleDateString(locale, { year: 'numeric', month: 'long' });
              return (
                <div key={monthKey} className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-sm font-semibold text-slate-700">{monthLabel}</h3>
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-600">{list.length}건</span>
                  </div>
                  {/* Desktop */}
                  <div className="hidden md:block rounded-xl overflow-hidden border border-slate-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">구분</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">기간</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">일수</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">사유</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">상태</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {list.map((r: any) => (
                          <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-800">{leaveTypeDisplay(r)}</td>
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                              {r.type === 'QUARTER_DAY'
                                ? (r.startDate ? new Date(r.startDate).toLocaleDateString(locale) : '-')
                                : `${new Date(r.startDate).toLocaleDateString(locale)}${r.startDate !== r.endDate ? ` ~ ${new Date(r.endDate).toLocaleDateString(locale)}` : ''}`}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{r.days}{t('days')}</td>
                            <td className="px-4 py-3 text-slate-400 max-w-[200px] truncate">{r.type === 'FAMILY' ? '—' : r.reason || '-'}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(r.status)}`}>
                                {statusLabel[r.status]}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Mobile */}
                  <div className="md:hidden space-y-2">
                    {list.map((r: any) => (
                      <div key={r.id} className="rounded-xl border border-slate-100 p-4 bg-slate-50/50">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="font-semibold text-slate-800 text-sm">{leaveTypeDisplay(r)}</span>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold shrink-0 ${statusBadge(r.status)}`}>{statusLabel[r.status]}</span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {r.type === 'QUARTER_DAY'
                            ? (r.startDate ? `${new Date(r.startDate).toLocaleDateString(locale)} · ${r.days}${t('days')}` : '-')
                            : `${new Date(r.startDate).toLocaleDateString(locale)}${r.startDate !== r.endDate ? ` ~ ${new Date(r.endDate).toLocaleDateString(locale)}` : ''} · ${r.days}${t('days')}`}
                        </p>
                        {r.type !== 'FAMILY' && r.reason && <p className="text-xs text-slate-400 mt-1 line-clamp-1">{r.reason}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Form Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl my-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900">{t('leaveRequest')}</h3>
              <button onClick={closeForm} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Leave type */}
              <div>
                <label className={LABEL_CLS}>{t('leaveTypeLabel')}</label>
                <select value={form.type} onChange={(e) => handleTypeChange(e.target.value as LeaveTypeValue)} className={INPUT_CLS}>
                  <option value="ANNUAL">{t('annual')}</option>
                  <option value="HALF_DAY_AM">{t('halfDayAm')}</option>
                  <option value="HALF_DAY_PM">{t('halfDayPm')}</option>
                  <option value="QUARTER_DAY">{t('quarterDay')}</option>
                  <option value="SICK">{t('sick')}</option>
                  <option value="OFFICIAL">{t('official')}</option>
                  <option value="FAMILY">{t('family')}</option>
                </select>
              </div>

              {/* Family sub-type */}
              {isFamily && (
                <div>
                  <label className={LABEL_CLS}>{t('familySubTypeLabel')}</label>
                  <select
                    value={form.familySubType || 'OWN_MARRIAGE'}
                    onChange={(e) => setForm({ ...form, familySubType: e.target.value as FamilyLeaveSubType })}
                    className={INPUT_CLS}
                  >
                    {FAMILY_LEAVE_SUBTYPES.map((st) => {
                      const days = FAMILY_LEAVE_BUSINESS_DAYS[st];
                      const daysLabel = t('familyLeaveBusinessDaysLabel').replace('{0}', String(days));
                      return (
                        <option key={st} value={st}>
                          {t(`familySub_${st}` as TranslationKey)} ({daysLabel})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Quarter day amount */}
              {isQuarterDay && (
                <div>
                  <label className={LABEL_CLS}>{t('quarterDayUnit')}</label>
                  <select
                    value={form.quarterDays}
                    onChange={(e) => setForm({ ...form, quarterDays: parseFloat(e.target.value) })}
                    className={INPUT_CLS}
                  >
                    <option value={0.25}>0.25{t('days')}</option>
                    <option value={0.75}>0.75{t('days')}</option>
                  </select>
                </div>
              )}

              {/* Date fields */}
              {isSingleDay || isFamily ? (
                <div>
                  <label className={LABEL_CLS}>{t('date')}</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value, endDate: isSingleDay ? e.target.value : '' })}
                    className={INPUT_CLS}
                    min="2024-01-01"
                    max="2027-12-31"
                  />
                  {isFamily && familyEndPreview && form.startDate && form.familySubType && (
                    <p className="text-sm font-medium text-slate-700 mt-2 p-2.5 rounded-lg bg-indigo-50">
                      {t('familyLeaveEndPreview')
                        .replace('{0}', familyEndPreview.toLocaleDateString(locale))
                        .replace('{1}', t('familyLeaveBusinessDaysLabel').replace('{0}', String(FAMILY_LEAVE_BUSINESS_DAYS[form.familySubType as FamilyLeaveSubType])))}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className={LABEL_CLS}>{t('startDate')} ~ {t('endDate')}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      className={`${INPUT_CLS} flex-1`}
                      min="2024-01-01"
                      max="2027-12-31"
                    />
                    <span className="text-slate-400 text-sm shrink-0">~</span>
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                      className={`${INPUT_CLS} flex-1`}
                      min={form.startDate || '2024-01-01'}
                      max="2027-12-31"
                    />
                  </div>
                </div>
              )}

              {/* Reason */}
              {!isFamily && (
                <div>
                  <label className={LABEL_CLS}>
                    {t('reason')} <span className="text-slate-300 normal-case font-normal">{t('optional')}</span>
                  </label>
                  <textarea
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    rows={3}
                    placeholder={t('inputReason')}
                    className={`${INPUT_CLS} resize-none`}
                  />
                </div>
              )}
            </div>

            {error && (
              <div className="mt-4 rounded-xl bg-rose-50 border border-rose-100 p-3">
                <p className="text-sm text-rose-600">{error}</p>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeForm}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => submitLeave.mutate(
                  isQuarterDay
                    ? { type: form.type, days: form.quarterDays, startDate: form.startDate, reason: form.reason || undefined }
                    : isFamily
                      ? { type: 'FAMILY', startDate: form.startDate, familySubType: form.familySubType || 'OWN_MARRIAGE' }
                      : { type: form.type, startDate: form.startDate, endDate: isHalfDay ? form.startDate : form.endDate, reason: form.reason || undefined }
                )}
                disabled={!canSubmit}
                className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {submitLeave.isPending ? t('applying') : t('apply')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
