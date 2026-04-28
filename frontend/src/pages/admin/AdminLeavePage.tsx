import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { leaveTypeDisplay } from '@/lib/leaveTypeDisplay';
import { useTranslation } from '@/hooks/useTranslation';

type TabType = 'requests' | 'usage';

export default function AdminLeavePage() {
  const { t, lang } = useTranslation();
  const locale = lang === 'ja' ? 'ja-JP' : 'ko-KR';
  const typeLabel: Record<string, string> = { ANNUAL: t('annual'), HALF_DAY_AM: t('halfDayAm'), HALF_DAY_PM: t('halfDayPm'), QUARTER_DAY: t('quarterDay'), SICK: t('sick'), OFFICIAL: t('official'), FAMILY: t('family') };
  const [activeTab, setActiveTab] = useState<TabType>('requests');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [rejectTarget, setRejectTarget] = useState<{ id: string; name: string } | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: requests } = useQuery({
    queryKey: ['leave', 'admin'],
    queryFn: () => api.get('/leave/admin/requests').then((r) => r.data),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.patch(`/leave/requests/${id}/approve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leave'] }),
  });

  const reject = useMutation({
    mutationFn: (id: string) => api.patch(`/leave/requests/${id}/reject`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leave'] }),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.patch(`/leave/requests/${id}/revoke`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave'] });
      setRevokeTarget(null);
    },
    onError: (err: any) => alert(err.response?.data?.message || '오류가 발생했습니다.'),
  });

  const handleExportLeaveExcel = async () => {
    try {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      const { data } = await api.get('/leave/admin/export', {
        responseType: 'blob',
        params: { startDate, endDate },
      });
      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `연차신청_${selectedYear}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.response?.data?.message || '엑셀 다운로드에 실패했습니다.');
    }
  };

  const syncHolidays = useMutation({
    mutationFn: () => api.post('/holidays/sync', { startYear: new Date().getFullYear() - 1, endYear: new Date().getFullYear() + 2 }),
    onSuccess: (res) => {
      const { created = 0, updated = 0 } = res.data;
      alert(t('syncHolidaysSuccess').replace('{0}', String(created)).replace('{1}', String(updated)));
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
    },
    onError: (err: any) => alert(`${t('syncHolidaysError')}: ${err.response?.data?.message || err.message}`),
  });

  const employeeUsage = useMemo(() => {
    if (!requests || !users) return [];
    const approved = requests.filter((r: any) => r.status === 'APPROVED');
    const byYear = approved.filter((r: any) => new Date(r.startDate).getFullYear() === selectedYear);

    return users
      .filter((u: any) => u.isActive)
      .map((u: any) => {
        const myLeaves = byYear.filter((r: any) => r.userId === u.id || r.user?.id === u.id);
        const totalUsed = myLeaves.reduce((sum: number, r: any) => sum + r.days, 0);
        const lb = u.leaveBalance;
        const total = lb?.totalDays ?? 0;
        const used = lb?.usedDays ?? 0;
        const remaining = total - used;

        return {
          ...u,
          myLeaves,
          totalUsed,
          remaining,
        };
      })
      .sort((a: any, b: any) =>
        String(a?.name ?? a?.email ?? '').localeCompare(String(b?.name ?? b?.email ?? ''))
      );
  }, [requests, users, selectedYear]);

  const pendingRequests = requests?.filter((r: any) => r.status === 'PENDING') ?? [];
  const historyRequests = useMemo(
    () =>
      requests?.filter(
        (r: any) =>
          r.status !== 'PENDING' && new Date(r.startDate).getFullYear() === selectedYear
      ) ?? [],
    [requests, selectedYear]
  );

  /** 월별 그룹핑: { "2026-03": [...], "2026-02": [...] } 최신순 */
  const historyByMonth = useMemo(() => {
    const map: Record<string, any[]> = {};
    historyRequests.forEach((r: any) => {
      const d = new Date(r.startDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return Object.fromEntries(
      Object.entries(map).sort(([a], [b]) => b.localeCompare(a))
    );
  }, [historyRequests]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">{t('leaveMgmt')}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportLeaveExcel}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-emerald-500 text-emerald-700 hover:bg-emerald-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            {t('exportLeaveExcel')}
          </button>
          <button
            onClick={() => syncHolidays.mutate()}
            disabled={syncHolidays.isPending}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {syncHolidays.isPending ? t('processing') : t('syncHolidays')}
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'requests' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t('requestMgmt')}
            {pendingRequests.length > 0 && (
              <span className="ml-1.5 bg-white/40 px-1.5 rounded text-xs font-semibold">{pendingRequests.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('usage')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'usage' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t('employeeLeaveStatus')}
          </button>
        </div>
      </div>

      {/* 승인 취소(반려) 모달 */}
      {revokeTarget && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-gray-800 mb-2">{t('revokeApprove')}</h3>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{revokeTarget.name}</strong> {t('revokeConfirm')}
            </p>
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg mb-5">
              {t('revokeNote')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setRevokeTarget(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium"
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => revoke.mutate(revokeTarget.id)}
                disabled={revoke.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-sm font-medium"
              >
                {revoke.isPending ? t('processing') : t('revokeApprove')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 반려 확인 모달 */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-gray-800 mb-2">{t('rejectLeaveTitle')}</h3>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{rejectTarget.name}</strong> {t('rejectLeaveConfirm')}
            </p>
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg mb-5">
              {t('rejectNote')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setRejectTarget(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium"
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => {
                  reject.mutate(rejectTarget.id);
                  setRejectTarget(null);
                }}
                disabled={reject.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-sm font-medium"
              >
                {reject.isPending ? t('processing') : t('rejected')}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">{t('year')}</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[new Date().getFullYear() + 1, new Date().getFullYear(), new Date().getFullYear() - 1].map((y) => (
                <option key={y} value={y}>{y}{t('year')}</option>
              ))}
            </select>
          </div>
          {/* 대기 중인 신청 - 카드로 강조 */}
          {pendingRequests.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                {t('pending')} ({pendingRequests.length}{t('count')})
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {pendingRequests.map((r: any) => (
                  <div
                    key={r.id}
                    className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 flex flex-col gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-800 truncate">{r.user?.profile?.name || r.user?.email}</p>
                      <p className="text-sm text-gray-600 mt-0.5 break-words">
                        {leaveTypeDisplay(r, t, typeLabel)}
                        {r.type !== 'QUARTER_DAY' &&
                          ` · ${new Date(r.startDate).toLocaleDateString(locale)} ~ ${new Date(r.endDate).toLocaleDateString(locale)}`}
                        {r.type === 'QUARTER_DAY' && ` · ${r.startDate ? new Date(r.startDate).toLocaleDateString(locale) + ' · ' : ''}${r.days}${t('days')}`}
                      </p>
                      {r.reason && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{r.reason}</p>}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                      <button
                        onClick={() => approve.mutate(r.id)}
                        disabled={approve.isPending}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg"
                      >
                        {t('approveAction')}
                      </button>
                      <button
                        onClick={() => setRejectTarget({ id: r.id, name: r.user?.profile?.name || r.user?.email })}
                        className="px-4 py-2 border border-red-300 text-red-600 hover:bg-red-50 text-sm font-medium rounded-lg"
                      >
                        {t('rejected')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 전체 이력 - 월별 섹션 */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <h3 className="px-4 sm:px-6 py-4 text-sm font-semibold text-gray-700 border-b border-gray-100 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              {t('leaveHistory')}
            </h3>
            {requests?.length === 0 && (
              <p className="px-6 py-12 text-center text-sm text-gray-500">{t('noLeaveHistory')}</p>
            )}
            {historyRequests.length === 0 && pendingRequests.length > 0 && requests && requests.length > 0 && (
              <p className="px-6 py-8 text-center text-xs text-gray-400">
                {lang === 'ja' ? '承認・却下済みの履歴はここに表示されます。' : '승인·반려된 이력이 여기에 표시됩니다.'}
              </p>
            )}
            {Object.keys(historyByMonth).length > 0 && (
              <div className="divide-y divide-gray-100">
                {Object.entries(historyByMonth).map(([monthKey, list]) => {
                  const [y, m] = monthKey.split('-').map(Number);
                  const monthLabel = new Date(y, m - 1).toLocaleDateString(locale, { year: 'numeric', month: 'long' });
                  return (
                    <div key={monthKey} className="p-4 sm:p-6">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                          <span className="w-1.5 h-4 rounded bg-blue-500" />
                          {monthLabel}
                        </h4>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{list.length}{t('count')}</span>
                      </div>
                      {/* 데스크톱: 테이블 */}
                      <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{t('employee')}</th>
                              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{t('type')}</th>
                              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{t('period')}</th>
                              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{t('days')}</th>
                              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{t('status')}</th>
                              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{t('action')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {list.map((r: any) => (
                              <tr key={r.id} className="hover:bg-gray-50/50">
                                <td className="px-4 py-2.5 font-medium text-gray-800">{r.user?.profile?.name || r.user?.email}</td>
                                <td className="px-4 py-2.5 text-gray-600">{leaveTypeDisplay(r, t, typeLabel)}</td>
                                <td className="px-4 py-2.5 text-gray-600">
                                  {r.type === 'QUARTER_DAY' ? (r.startDate ? new Date(r.startDate).toLocaleDateString(locale) : '-') : `${new Date(r.startDate).toLocaleDateString(locale)} ~ ${new Date(r.endDate).toLocaleDateString(locale)}`}
                                </td>
                                <td className="px-4 py-2.5 text-gray-600">{r.days}{t('days')}</td>
                                <td className="px-4 py-2.5">
                                  <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium ${r.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {r.status === 'APPROVED' ? t('approved') : t('rejected')}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">
                                  {r.status === 'APPROVED' && (
                                    <button onClick={() => setRevokeTarget({ id: r.id, name: r.user?.profile?.name || r.user?.email })} className="text-xs text-amber-600 hover:text-amber-700 hover:underline font-medium">
                                      {t('revokeApprove')}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {/* 모바일: 카드 */}
                      <div className="md:hidden space-y-2">
                        {list.map((r: any) => (
                          <div key={r.id} className="p-3 rounded-lg border border-gray-200 bg-gray-50/50">
                            <div className="flex justify-between items-start gap-3">
                              <span className="font-semibold text-gray-800">{r.user?.profile?.name || r.user?.email}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-medium ${r.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {r.status === 'APPROVED' ? t('approved') : t('rejected')}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              {leaveTypeDisplay(r, t, typeLabel)}
                              {r.type !== 'QUARTER_DAY' && ` · ${new Date(r.startDate).toLocaleDateString(locale)} ~ ${new Date(r.endDate).toLocaleDateString(locale)}`}
                              {r.type === 'QUARTER_DAY' && ` · ${r.startDate ? new Date(r.startDate).toLocaleDateString(locale) + ' · ' : ''}${r.days}${t('days')}`}
                            </p>
                            {r.status === 'APPROVED' && (
                              <button onClick={() => setRevokeTarget({ id: r.id, name: r.user?.profile?.name || r.user?.email })} className="text-xs text-amber-600 hover:text-amber-700 font-medium mt-2">
                                {t('revokeApprove')}
                              </button>
                            )}
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
            <label className="text-sm font-medium text-gray-700">{t('year')}</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[new Date().getFullYear() + 1, new Date().getFullYear(), new Date().getFullYear() - 1].map((y) => (
                <option key={y} value={y}>
                  {y}{t('year')}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* 데스크톱: 테이블 */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 sticky left-0 bg-gray-50 z-10 min-w-[120px]">
                      {t('employee')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                      <span className="block">{t('leaveBalanceSummary')}</span>
                      <span className="block text-xs font-normal text-gray-400 mt-0.5">
                        {t('total')} · {t('used')} · {lang === 'ja' ? '残' : '잔여'}
                      </span>
                      {selectedYear !== new Date().getFullYear() && (
                        <span className="block text-xs font-normal text-amber-600 mt-0.5">{t('currentYearNote')}</span>
                      )}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 min-w-[280px]">
                      {t('leaveUsageDetail')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {employeeUsage.map((emp: any) => (
                    <tr key={emp.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-3 font-medium text-gray-800 sticky left-0 bg-white z-10">
                        {emp.name || emp.email}
                      </td>
                      <td className="px-6 py-3.5 text-gray-600">
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                          <span><span className="text-gray-400">{t('total')}</span> <strong className="text-gray-700">{emp.leaveBalance?.totalDays ?? 0}</strong>{t('days')}</span>
                          <span><span className="text-gray-400">{t('used')}</span> <strong className="text-blue-600">{emp.leaveBalance?.usedDays ?? 0}</strong>{t('days')}</span>
                          <span><span className="text-gray-400">{t('remainingShort')}</span> <strong className="text-green-600">{emp.remaining}</strong>{t('days')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-gray-600">
                        {emp.myLeaves.length === 0 ? (
                          <span className="text-gray-400">-</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {emp.myLeaves
                              .sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                              .map((r: any) => {
                                const start = new Date(r.startDate);
                                const end = new Date(r.endDate);
                                const label = leaveTypeDisplay(r, t, typeLabel);
                                const range =
                                  start.getTime() === end.getTime()
                                    ? start.toLocaleDateString(locale)
                                    : `${start.toLocaleDateString(locale)}~${end.toLocaleDateString(locale)}`;
                                return (
                                  <span
                                    key={r.id}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700"
                                    title={r.reason || ''}
                                  >
                                    {label} {range} ({r.days}{t('days')})
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
            {/* 모바일: 직원별 카드 */}
            <div className="md:hidden divide-y divide-gray-100">
              {employeeUsage.map((emp: any) => (
                <div key={emp.id} className="p-4 flex flex-col gap-3">
                  <p className="font-semibold text-gray-800">{emp.name || emp.email}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                    <span><span className="text-gray-400">{t('total')}</span> <strong className="text-gray-700">{emp.leaveBalance?.totalDays ?? 0}</strong>{t('days')}</span>
                    <span><span className="text-gray-400">{t('used')}</span> <strong className="text-blue-600">{emp.leaveBalance?.usedDays ?? 0}</strong>{t('days')}</span>
                    <span><span className="text-gray-400">{t('remainingShort')}</span> <strong className="text-green-600">{emp.remaining}</strong>{t('days')}</span>
                  </div>
                  {emp.myLeaves.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1.5">{t('leaveUsageDetail')}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {emp.myLeaves
                          .sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                          .map((r: any) => {
                            const start = new Date(r.startDate);
                            const end = new Date(r.endDate);
                            const label = leaveTypeDisplay(r, t, typeLabel);
                            const range =
                              start.getTime() === end.getTime()
                                ? start.toLocaleDateString(locale)
                                : `${start.toLocaleDateString(locale)}~${end.toLocaleDateString(locale)}`;
                            return (
                              <span
                                key={r.id}
                                className="inline-block px-2 py-1 rounded text-xs bg-blue-50 text-blue-700"
                                title={r.reason || ''}
                              >
                                {label} {range} ({r.days}{t('days')})
                              </span>
                            );
                          })}
                      </div>
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
