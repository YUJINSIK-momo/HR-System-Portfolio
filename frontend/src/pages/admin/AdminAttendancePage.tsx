import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import { TimeSelectInput } from '@/components/TimeSelectInput';

const PAGE_SIZE = 20;

export default function AdminAttendancePage() {
  const { t, lang } = useTranslation();
  const locale = lang === 'ja' ? 'ja-JP' : 'ko-KR';
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  );
  const [viewMode, setViewMode] = useState<'date' | 'list'>('date');
  const [attPage, setAttPage] = useState(1);
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(null);
  const [editTarget, setEditTarget] = useState<{ id: string; name: string; checkIn: string; checkOut: string; date: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const queryClient = useQueryClient();

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const [y] = selectedMonth.split('-');
      const res = await api.get('/attendance/admin/export', {
        responseType: 'blob',
        params: { year: y, startDate, endDate },
      });
      const cd = res.headers['content-disposition'];
      const match = cd?.match(/filename\*=UTF-8''(.+)/);
      const fileName = match ? decodeURIComponent(match[1]) : `근태현황_${startDate}_${endDate}.xlsx`;
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.response?.data?.message || t('exportError'));
    } finally {
      setExporting(false);
    }
  };

  const toTimeOnly = (iso: string | null | undefined) => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [startDate, endDate] = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
  }, [selectedMonth]);

  const { data: records } = useQuery({
    queryKey: ['attendance', 'admin', startDate, endDate],
    queryFn: () => api.get('/attendance/admin', { params: { startDate, endDate } }).then((r) => r.data),
  });

  const { data: pendingCorrections } = useQuery({
    queryKey: ['attendance-corrections', 'admin', 'PENDING'],
    queryFn: () => api.get('/attendance-corrections/admin', { params: { status: 'PENDING' } }).then((r) => r.data),
  });

  const approveCorrection = useMutation({
    mutationFn: (id: string) => api.patch(`/attendance-corrections/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-corrections'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });

  const rejectCorrection = useMutation({
    mutationFn: (id: string) => api.patch(`/attendance-corrections/${id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-corrections'] });
    },
  });

  const resetAttendance = useMutation({
    mutationFn: (id: string) => api.delete(`/attendance/${id}/reset`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      setResetTarget(null);
    },
  });

  const updateAttendance = useMutation({
    mutationFn: ({ id, checkIn, checkOut }: { id: string; checkIn?: string | null; checkOut?: string | null }) =>
      api.patch(`/attendance/${id}`, { checkIn: checkIn ?? undefined, checkOut: checkOut ?? undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      setEditTarget(null);
    },
  });

  const chartData = useMemo(() => {
    if (!records?.length) return [];
    const [y, m] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const byDate: Record<string, { count: number; date: string; label: string }> = {};

    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      byDate[key] = { date: key, count: 0, label: `${d}일` };
    }

    records.forEach((r: any) => {
      if (r.checkIn) {
        const key = new Date(r.date).toISOString().slice(0, 10);
        if (byDate[key]) byDate[key].count += 1;
      }
    });

    return Object.values(byDate);
  }, [records, selectedMonth, t]);

  const summary = useMemo(() => {
    if (!records?.length) return { totalDays: 0, uniqueEmployees: 0, avgPerDay: 0 };
    const uniqueIds = new Set(records.map((r: any) => r.userId));
    const withCheckIn = records.filter((r: any) => r.checkIn);
    const totalDays = withCheckIn.length;
    const [y, m] = selectedMonth.split('-').map(Number);
    const workDays = new Date(y, m, 0).getDate();
    return {
      totalDays,
      uniqueEmployees: uniqueIds.size,
      avgPerDay: workDays > 0 ? (totalDays / workDays).toFixed(1) : 0,
    };
  }, [records, selectedMonth]);

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const workLocationLabel = (wl: string | null | undefined) =>
    wl === 'OVERSEAS' ? t('workOverseas') : t('workOffice');
  /** 근태 상태 라벨: 지각 시 "지각 출근", 정상 시 "출근"/"해외근무" */
  const attendanceStatusLabel = (r: { status?: string; workLocation?: string | null }) => {
    if (r.status === 'LATE') return r.workLocation === 'OVERSEAS' ? `${t('lateCheckIn')} (${t('workOverseas')})` : t('lateCheckIn');
    if (r.status === 'EARLY_LEAVE') return t('earlyLeave');
    if (r.status === 'ABSENT') return t('absent');
    if (r.status === 'ON_LEAVE') return t('onLeave');
    return workLocationLabel(r.workLocation);
  };

  const recordsByDate = useMemo(() => {
    if (!records?.length) return {};
    const map: Record<string, any[]> = {};
    records.forEach((r: any) => {
      const key = new Date(r.date).toISOString().slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return Object.fromEntries(Object.entries(map).sort(([a], [b]) => b.localeCompare(a)));
  }, [records]);

  const attTotalPages = Math.ceil((records?.length ?? 0) / PAGE_SIZE) || 1;
  const attPaginatedRecords = useMemo(() => {
    if (!records?.length) return [];
    return records.slice((attPage - 1) * PAGE_SIZE, attPage * PAGE_SIZE);
  }, [records, attPage]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">{t('attendanceStatus')}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
          />
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-emerald-500 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            {t('exportAttendanceExcel')}
          </button>
        </div>
      </div>

      {pendingCorrections && pendingCorrections.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 p-6 mb-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-bold text-amber-800">
              {pendingCorrections.length}
            </span>
            {t('attendanceCorrectionAdminSection')}
          </h3>
          <div className="overflow-x-auto border border-gray-100 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{t('employee')}</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{t('attendanceCorrectionKind')}</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{t('date')}</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{t('attendanceCorrectionProposedIn')}</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{t('attendanceCorrectionProposedOut')}</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{t('attendanceCorrectionReason')}</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{t('action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendingCorrections.map((c: any) => {
                  const name = c.user?.profile?.name || c.user?.email || '';
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/80">
                      <td className="px-4 py-3 font-medium text-gray-800">{name}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {c.kind === 'ADD_MISSING' ? t('attendanceCorrectionAddMissing') : t('attendanceCorrectionEditTimes')}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-600">{new Date(c.workDate).toLocaleDateString(locale)}</td>
                      <td className="px-4 py-3 tabular-nums text-gray-600">
                        {c.proposedCheckIn ? formatTime(c.proposedCheckIn) : '—'}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-600">
                        {c.proposedCheckOut ? formatTime(c.proposedCheckOut) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate" title={c.reason || ''}>
                        {c.reason || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={approveCorrection.isPending}
                            onClick={() => approveCorrection.mutate(c.id)}
                            className="text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg disabled:opacity-50"
                          >
                            {t('approved')}
                          </button>
                          <button
                            type="button"
                            disabled={rejectCorrection.isPending}
                            onClick={() => rejectCorrection.mutate(c.id)}
                            className="text-xs font-medium text-gray-700 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                          >
                            {t('rejected')}
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

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm text-gray-500 mb-0.5">{t('monthTotalCheckIn')}</p>
            <p className="text-2xl font-bold text-gray-800 tabular-nums">{summary.totalDays}<span className="text-base font-normal text-gray-500 ml-0.5">{t('days')}</span></p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm text-gray-500 mb-0.5">{t('employeesWithCheckIn')}</p>
            <p className="text-2xl font-bold text-gray-800 tabular-nums">{summary.uniqueEmployees}<span className="text-base font-normal text-gray-500 ml-0.5">{t('persons')}</span></p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm text-gray-500 mb-0.5">{t('avgCheckInPerDay')}</p>
            <p className="text-2xl font-bold text-gray-800 tabular-nums">{summary.avgPerDay}<span className="text-base font-normal text-gray-500 ml-0.5">{t('count')}</span></p>
          </div>
        </div>
      </div>

      {/* 일별 출근 현황 그래프 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          {t('dailyCheckIn')}
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} width={28} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                formatter={(value) => [`${value ?? 0}${t('persons')}`, t('checkInCount')]}
                labelFormatter={(label) => `${label}`}
              />
              <Bar dataKey="count" name={t('checkInLabel')} radius={[6, 6, 0, 0]} maxBarSize={32}>
                {chartData.map((entry, index) => {
                  const today = new Date();
                  const entryDate = new Date(entry.date);
                  const isToday = entryDate.toDateString() === today.toDateString();
                  return <Cell key={index} fill={entry.count > 0 ? (isToday ? '#2563eb' : '#60a5fa') : '#f3f4f6'} stroke={isToday && entry.count > 0 ? '#1d4ed8' : undefined} strokeWidth={isToday ? 1 : 0} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-400" /> {t('chartLegendWithAttendance')}</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-gray-200" /> {t('chartLegendNoAttendance')}</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-600 ring-1 ring-blue-700 ring-offset-1" /> {t('chartLegendToday')}</span>
        </div>
      </div>

      {/* 반려 확인 모달 */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-gray-800 mb-2">{t('attendanceResetTitle')}</h3>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{resetTarget.name}</strong> {t('attendanceResetConfirm')}
            </p>
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-5">
              {t('cannotUndo')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setResetTarget(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium"
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => resetAttendance.mutate(resetTarget.id)}
                disabled={resetAttendance.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-sm font-medium"
              >
                {resetAttendance.isPending ? t('processing') : t('resetConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 출퇴근 시간 변경 모달 */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-gray-800 mb-2">{t('editAttendanceTime')}</h3>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{editTarget.name}</strong> · {new Date(editTarget.date).toLocaleDateString(locale)}
            </p>
            <div className="space-y-4 mb-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
                <div className="flex-1 min-w-0">
                  <TimeSelectInput
                    label={t('checkInTime')}
                    value={editTarget.checkIn}
                    onChange={(v) => setEditTarget((p) => (p ? { ...p, checkIn: v } : null))}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!editTarget?.checkIn) return;
                    updateAttendance.mutate({
                      id: editTarget.id,
                      checkIn: new Date(`${editTarget.date}T${editTarget.checkIn}`).toISOString(),
                    });
                  }}
                  disabled={updateAttendance.isPending || !editTarget.checkIn}
                  className="shrink-0 w-full sm:w-auto px-4 py-2.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                >
                  {updateAttendance.isPending ? t('processing') : t('saveCheckInOnly')}
                </button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
                <div className="flex-1 min-w-0">
                  <TimeSelectInput
                    label={t('checkOutTime')}
                    value={editTarget.checkOut}
                    onChange={(v) => setEditTarget((p) => (p ? { ...p, checkOut: v } : null))}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!editTarget?.checkOut) return;
                    updateAttendance.mutate({
                      id: editTarget.id,
                      checkOut: new Date(`${editTarget.date}T${editTarget.checkOut}`).toISOString(),
                    });
                  }}
                  disabled={updateAttendance.isPending || !editTarget.checkOut}
                  className="shrink-0 w-full sm:w-auto px-4 py-2.5 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                >
                  {updateAttendance.isPending ? t('processing') : t('saveCheckOutOnly')}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상세 내역 - 월별/일별 토글 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-base font-semibold text-gray-700">{t('detailRecords')}</h3>
          <div className="flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
            <button
              type="button"
              onClick={() => setViewMode('date')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors min-w-[72px] ${
                viewMode === 'date' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {t('viewByDate')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors min-w-[72px] ${
                viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {t('viewByList')}
            </button>
          </div>
        </div>

        {(!records || records.length === 0) && (
          <p className="px-6 py-12 text-center text-sm text-gray-400">{t('noRecords')}</p>
        )}

        {records && records.length > 0 && viewMode === 'date' && (
          <div className="p-4 sm:p-6 space-y-4">
            {Object.entries(recordsByDate).map(([dateKey, list]) => {
              const dateObj = new Date(dateKey);
              const isTodayDate = dateObj.toDateString() === now.toDateString();
              return (
                <div key={dateKey} className={`rounded-xl border overflow-hidden ${isTodayDate ? 'ring-2 ring-blue-200 border-blue-200' : 'border-gray-200 bg-white'}`}>
                  <div className={`px-4 py-2.5 flex items-center justify-between ${isTodayDate ? 'bg-blue-50' : 'bg-gray-50'}`}>
                    <span className={`text-sm font-semibold ${isTodayDate ? 'text-blue-800' : 'text-gray-800'}`}>
                      {dateObj.toLocaleDateString(locale, { month: 'long', day: 'numeric', weekday: 'short' })}
                      {isTodayDate && <span className="ml-2 text-xs font-normal text-blue-600">({t('chartLegendToday')})</span>}
                    </span>
                    <span className="text-xs font-medium text-gray-500 bg-white/80 px-2 py-0.5 rounded-full">{list.length}{t('persons')}</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {list.map((r: any) => {
                      const name = r.user?.profile?.name || r.user?.email;
                      return (
                        <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 px-4 sm:flex-nowrap hover:bg-gray-50/50 transition-colors">
                          <span className="font-medium text-gray-800 w-24 sm:w-auto">{name}</span>
                          <span className={`text-xs px-2.5 py-1 rounded-full shrink-0 font-medium ${
                            r.status === 'LATE' ? 'bg-amber-100 text-amber-700' : r.workLocation === 'OVERSEAS' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>{attendanceStatusLabel(r)}</span>
                          <span className="text-sm text-gray-600 flex items-center gap-1.5 shrink-0">
                            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {r.checkIn ? formatTime(r.checkIn) : '-'} → {r.checkOut ? formatTime(r.checkOut) : '-'}
                          </span>
                          <div className="flex gap-2 shrink-0 ml-auto">
                            <button
                              onClick={() => {
                                const dk = new Date(r.date).toISOString().slice(0, 10);
                                setEditTarget({ id: r.id, name, date: dk, checkIn: r.checkIn ? toTimeOnly(r.checkIn) : '09:00', checkOut: r.checkOut ? toTimeOnly(r.checkOut) : '18:00' });
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              {t('editAttendanceTime')}
                            </button>
                            <button
                              onClick={() => setResetTarget({ id: r.id, name })}
                              className="text-xs text-red-500 hover:text-red-700 font-medium"
                            >
                              {t('reset')}
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

        {records && records.length > 0 && viewMode === 'list' && (
          <>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500">{t('employee')}</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500">{t('date')}</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500">{t('todayCheckIn')}</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500">{t('todayCheckOut')}</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500">{t('status')}</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500">{t('action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {attPaginatedRecords.map((r: any) => {
                    const name = r.user?.profile?.name || r.user?.email;
                    return (
                      <tr key={r.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-6 py-3 font-medium text-gray-800">{name}</td>
                        <td className="px-6 py-3 text-gray-600 tabular-nums">{new Date(r.date).toLocaleDateString(locale)}</td>
                        <td className="px-6 py-3 text-gray-600 tabular-nums">
                          <span className="inline-flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {r.checkIn ? formatTime(r.checkIn) : '—'}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-gray-600 tabular-nums">
                          <span className="inline-flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {r.checkOut ? formatTime(r.checkOut) : '—'}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            r.status === 'LATE' ? 'bg-amber-100 text-amber-700' : r.workLocation === 'OVERSEAS' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                          }`}>{attendanceStatusLabel(r)}</span>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => {
                              const dateKey = new Date(r.date).toISOString().slice(0, 10);
                              setEditTarget({ id: r.id, name, date: dateKey, checkIn: r.checkIn ? toTimeOnly(r.checkIn) : '09:00', checkOut: r.checkOut ? toTimeOnly(r.checkOut) : '18:00' });
                            }} className="text-xs text-blue-600 hover:text-blue-800 hover:underline">{t('editAttendanceTime')}</button>
                            <button onClick={() => setResetTarget({ id: r.id, name })} className="text-xs text-red-500 hover:text-red-700 hover:underline">{t('reset')}</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="sm:hidden divide-y divide-gray-100">
              {attPaginatedRecords.map((r: any) => {
                const name = r.user?.profile?.name || r.user?.email;
                return (
                  <div key={r.id} className="p-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-medium text-gray-800">{name}</span>
                      <span className={`text-xs px-2 py-1 rounded-full shrink-0 font-medium ${
                        r.status === 'LATE' ? 'bg-amber-100 text-amber-700' : r.workLocation === 'OVERSEAS' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>{attendanceStatusLabel(r)}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1 tabular-nums">{new Date(r.date).toLocaleDateString(locale)}</p>
                    <p className="text-sm text-gray-600 mt-1 flex items-center gap-2 tabular-nums">
                      <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {r.checkIn ? formatTime(r.checkIn) : '—'} → {r.checkOut ? formatTime(r.checkOut) : '—'}
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => {
                        const dateKey = new Date(r.date).toISOString().slice(0, 10);
                        setEditTarget({ id: r.id, name, date: dateKey, checkIn: r.checkIn ? toTimeOnly(r.checkIn) : '09:00', checkOut: r.checkOut ? toTimeOnly(r.checkOut) : '18:00' });
                      }} className="text-xs text-blue-600 hover:text-blue-800">{t('editAttendanceTime')}</button>
                      <button onClick={() => setResetTarget({ id: r.id, name })} className="text-xs text-red-500 hover:text-red-700">{t('reset')}</button>
                    </div>
                  </div>
                );
              })}
            </div>
            {attTotalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                <p className="text-sm text-gray-500">{t('total')} {records?.length ?? 0}{t('count')}</p>
                <div className="flex gap-2">
                  <button onClick={() => setAttPage((p) => Math.max(1, p - 1))} disabled={attPage <= 1} className="px-3 py-1.5 rounded border border-gray-300 text-sm font-medium disabled:opacity-50">←</button>
                  <span className="px-3 py-1.5 text-sm text-gray-700">{attPage} / {attTotalPages}</span>
                  <button onClick={() => setAttPage((p) => Math.min(attTotalPages, p + 1))} disabled={attPage >= attTotalPages} className="px-3 py-1.5 rounded border border-gray-300 text-sm font-medium disabled:opacity-50">→</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
