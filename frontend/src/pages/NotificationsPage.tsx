import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import api from '@/lib/api';
import { leaveTypeDisplay } from '@/lib/leaveTypeDisplay';
import { useNotificationStore } from '@/stores/notificationStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuthStore } from '@/stores/authStore';

const statusLabelMap: Record<string, string> = { PENDING: '대기', APPROVED: '승인', REJECTED: '반려' };

export default function NotificationsPage() {
  const { t, lang } = useTranslation();
  const locale = lang === 'ja' ? 'ja-JP' : 'ko-KR';
  const isForeignFreelancer = useAuthStore((s) => s.user?.role === 'FOREIGN_FREELANCER');
  const setLastLeaveReadAt = useNotificationStore((s) => s.setLastLeaveReadAt);
  const setLastMemoReadAt = useNotificationStore((s) => s.setLastMemoReadAt);
  const setLastAnnouncementReadAt = useNotificationStore((s) => s.setLastAnnouncementReadAt);
  const lastAnnouncementReadAt = useNotificationStore((s) => s.lastAnnouncementReadAt);

  const [activeTab, setActiveTab] = useState<'leave' | 'memo' | 'announcement'>(() =>
    isForeignFreelancer ? 'announcement' : 'leave'
  );

  useEffect(() => {
    if (activeTab === 'leave' && !isForeignFreelancer) setLastLeaveReadAt();
    if (activeTab === 'memo') setLastMemoReadAt();
    if (activeTab === 'announcement') setLastAnnouncementReadAt();
  }, [activeTab, isForeignFreelancer, setLastLeaveReadAt, setLastMemoReadAt, setLastAnnouncementReadAt]);

  const { data: requests } = useQuery({
    queryKey: ['leave', 'notifications'],
    queryFn: () => api.get('/leave/notifications').then((r) => r.data),
    refetchInterval: 15_000,
    enabled: !isForeignFreelancer,
  });
  const { data: memoReminders = [] } = useQuery({
    queryKey: ['calendar', 'memo-reminders'],
    queryFn: () => api.get('/calendar/memo-reminders').then((r) => r.data),
    refetchInterval: 60_000,
  });
  const { data: announcements = [] } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => api.get('/announcements').then((r) => r.data),
    staleTime: 30_000,
  });

  const typeLabel: Record<string, string> = {
    ANNUAL: t('annual'), HALF_DAY_AM: t('halfDayAm'), HALF_DAY_PM: t('halfDayPm'),
    QUARTER_DAY: t('quarterDay'), SICK: t('sick'), OFFICIAL: t('official'), FAMILY: t('family'),
  };
  const statusLabel: Record<string, string> = lang === 'ja'
    ? { PENDING: '待機', APPROVED: '承認', REJECTED: '却下' }
    : statusLabelMap;

  const announcementUnreadCount =
    lastAnnouncementReadAt === 0
      ? 0
      : announcements.filter((a: { createdAt: string }) => new Date(a.createdAt).getTime() > lastAnnouncementReadAt).length;

  const statusBadge = (s: string) => {
    if (s === 'APPROVED') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100';
    if (s === 'REJECTED') return 'bg-rose-50 text-rose-700 ring-1 ring-rose-100';
    return 'bg-amber-50 text-amber-700 ring-1 ring-amber-100';
  };

  const tabs = [
    ...(!isForeignFreelancer ? [{ key: 'leave' as const, label: t('leaveNotificationsTab'), badge: 0 }] : []),
    { key: 'memo' as const, label: t('memoNotificationsTab'), badge: memoReminders.length },
    { key: 'announcement' as const, label: t('announcementNotificationsTab'), badge: announcementUnreadCount },
  ];

  return (
    <div className="min-h-full bg-slate-50 p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">{t('notifications')}</h1>
        <p className="mt-1 text-sm text-slate-500">휴가 승인 현황, 일정 알림, 공지사항을 확인하세요</p>
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 rounded-2xl bg-white border border-slate-100 shadow-sm p-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-200'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab.label}
            {tab.badge > 0 && (
              <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-xs font-bold ${activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Leave tab */}
      {activeTab === 'leave' && !isForeignFreelancer && (
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <p className="text-sm text-slate-500">{t('leaveNotificationsDesc')}</p>
          </div>
          {!requests || requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 mb-4">
                <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-400">{t('noLeaveHistory')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="bg-slate-50">
                    {[t('employee'), t('type'), t('period'), t('days'), t('reason'), t('status'), t('date')].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {requests.map((r: any) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3 font-medium text-slate-800">{r.user?.profile?.name || r.user?.email}</td>
                      <td className="px-5 py-3 text-slate-600">{leaveTypeDisplay(r, t, typeLabel)}</td>
                      <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
                        {r.type === 'QUARTER_DAY' ? '—'
                          : `${new Date(r.startDate).toLocaleDateString(locale)}${r.startDate !== r.endDate ? ` ~ ${new Date(r.endDate).toLocaleDateString(locale)}` : ''}`}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{r.days}{t('days')}</td>
                      <td className="px-5 py-3 text-slate-400 max-w-[180px] truncate" title={r.type === 'FAMILY' ? '' : r.reason || ''}>{r.type === 'FAMILY' ? '—' : r.reason || '-'}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(r.status)}`}>{statusLabel[r.status]}</span>
                      </td>
                      <td className="px-5 py-3 text-slate-400 whitespace-nowrap tabular-nums">{new Date(r.createdAt).toLocaleDateString(locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Memo tab */}
      {activeTab === 'memo' && (
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <p className="text-sm text-slate-500">{t('memoRemindersDesc')}</p>
          </div>
          {memoReminders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 mb-4">
                <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-400">{t('noMemoReminders')}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {memoReminders.map((m: any) => (
                <div key={m.id} className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50/70 transition-colors">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{m.title}</p>
                    {m.reminderDate && <p className="text-xs text-slate-400 mt-0.5">{new Date(m.reminderDate).toLocaleDateString(locale)}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Announcement tab */}
      {activeTab === 'announcement' && (
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm text-slate-500">{t('announcementNotificationsDesc')}</p>
            <NavLink to="/announcements" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">전체 보기 →</NavLink>
          </div>
          {announcements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 mb-4">
                <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-400">{t('noAnnouncements')}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {announcements.slice(0, 10).map((a: any) => {
                const isUnread = lastAnnouncementReadAt !== 0 && new Date(a.createdAt).getTime() > lastAnnouncementReadAt;
                return (
                  <NavLink key={a.id} to={`/announcements/${a.id}`} className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50/70 transition-colors group">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${a.pinned ? 'bg-amber-50' : 'bg-slate-50'}`}>
                      {a.pinned
                        ? <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                        : <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={`text-sm font-semibold truncate group-hover:text-indigo-600 transition-colors ${isUnread ? 'text-slate-900' : 'text-slate-700'}`}>{a.title}</p>
                        {isUnread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />}
                      </div>
                      <p className="text-xs text-slate-400">{new Date(a.createdAt).toLocaleDateString(locale)}</p>
                    </div>
                    <svg className="w-4 h-4 text-slate-300 shrink-0 mt-1 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
