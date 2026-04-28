import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuthStore } from '@/stores/authStore';
import type { TranslationKey } from '@/lib/translations';

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function CalendarPage() {
  const { t, lang } = useTranslation();
  const locale = lang === 'ja' ? 'ja-JP' : 'ko-KR';
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showDateDetailModal, setShowDateDetailModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editEvent, setEditEvent] = useState<any>(null);
  const [editMemo, setEditMemo] = useState<any>(null);
  const [eventForm, setEventForm] = useState({ title: '', description: '', startDate: '', endDate: '' });

  const { year, month } = useMemo(() => ({
    year: viewDate.getFullYear(),
    month: viewDate.getMonth(),
  }), [viewDate]);

  const start = useMemo(() => {
    const d = new Date(year, month, 1);
    return toDateKey(d);
  }, [year, month]);
  const end = useMemo(() => {
    const d = new Date(year, month + 1, 0);
    return toDateKey(d);
  }, [year, month]);

  const { data: events = [] } = useQuery({
    queryKey: ['calendar', 'events', start, end],
    queryFn: () => api.get('/calendar/events', { params: { start, end } }).then((r) => r.data),
  });

  const { data: memos = [] } = useQuery({
    queryKey: ['calendar', 'memos', start, end],
    queryFn: () => api.get('/calendar/memos', { params: { start, end } }).then((r) => r.data),
  });

  const { data: leaves = {} } = useQuery({
    queryKey: ['calendar', 'leaves', start, end],
    queryFn: () => api.get('/calendar/leaves', { params: { start, end } }).then((r) => r.data),
  });

  const holidayStart = useMemo(() => toDateKey(new Date(year, month - 1, 1)), [year, month]);
  const holidayEnd = useMemo(() => toDateKey(new Date(year, month + 2, 0)), [year, month]);
  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays', holidayStart, holidayEnd],
    queryFn: () => api.get('/holidays', { params: { start: holidayStart, end: holidayEnd } }).then((r) => r.data),
  });
  const holidayDateKeys = useMemo(
    () => new Set((holidays || []).map((h: { date: string }) => String(h.date).slice(0, 10))),
    [holidays]
  );
  const holidayNameByDate = useMemo(
    () => Object.fromEntries((holidays || []).map((h: { date: string; name: string }) => [String(h.date).slice(0, 10), h.name])),
    [holidays]
  );

  const eventsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    events.forEach((e: any) => {
      const startD = new Date(e.startDate);
      const endD = new Date(e.endDate);
      const iter = new Date(startD);
      while (iter <= endD) {
        const key = toDateKey(iter);
        if (!map[key]) map[key] = [];
        map[key].push(e);
        iter.setDate(iter.getDate() + 1);
      }
    });
    return map;
  }, [events]);

  const memosByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    memos.forEach((m: any) => {
      if (!map[m.date]) map[m.date] = [];
      map[m.date].push(m);
    });
    return map;
  }, [memos]);

  const calendarGrid = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startDay = first.getDay();
    const daysInMonth = last.getDate();
    const rows: Array<Array<{ date: string; day: number; isCurrentMonth: boolean }>> = [];
    let currentRow: Array<{ date: string; day: number; isCurrentMonth: boolean }> = [];

    const padStart = Math.max(0, startDay);
    const prevMonth = new Date(year, month, 0);
    const prevDays = prevMonth.getDate();
    for (let i = 0; i < padStart; i++) {
      const d = prevDays - padStart + i + 1;
      const date = new Date(year, month - 1, d);
      currentRow.push({ date: toDateKey(date), day: d, isCurrentMonth: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      currentRow.push({ date: toDateKey(date), day: d, isCurrentMonth: true });
      if (currentRow.length === 7) {
        rows.push(currentRow);
        currentRow = [];
      }
    }

    const nextMonthStart = new Date(year, month + 1, 1);
    let pad = 1;
    while (currentRow.length < 7) {
      currentRow.push({
        date: toDateKey(new Date(nextMonthStart.getFullYear(), nextMonthStart.getMonth(), pad)),
        day: pad,
        isCurrentMonth: false,
      });
      pad++;
    }
    if (currentRow.length) rows.push(currentRow);

    return rows;
  }, [year, month]);

  const selectedMemos = selectedDate ? (memosByDate[selectedDate] || []) : [];
  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : [];
  const selectedLeaves = selectedDate ? (leaves[selectedDate] || []) : [];

  const createEventMutation = useMutation({
    mutationFn: (data: any) => api.post('/calendar/events', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      setShowEventModal(false);
      setEditEvent(null);
      setEventForm({ title: '', description: '', startDate: '', endDate: '' });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/calendar/events/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      setShowEventModal(false);
      setEditEvent(null);
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/calendar/events/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar'] }),
  });

  const createMemoMutation = useMutation({
    mutationFn: ({ date, content, isShared }: { date: string; content: string; isShared: boolean }) =>
      api.post('/calendar/memos', { date, content, isShared }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      setShowDateDetailModal(false);
    },
  });

  const updateMemoMutation = useMutation({
    mutationFn: ({ id, content, isShared }: { id: string; content: string; isShared: boolean }) =>
      api.patch(`/calendar/memos/${id}`, { content, isShared }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      setShowDateDetailModal(false);
      setEditMemo(null);
    },
  });

  const deleteMemoMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/calendar/memos/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar'] }),
  });

  const handleOpenEventModal = (ev?: any) => {
    if (ev) {
      setEditEvent(ev);
      setEventForm({
        title: ev.title,
        description: ev.description || '',
        startDate: ev.startDate,
        endDate: ev.endDate,
      });
    } else {
      setEditEvent(null);
      setEventForm({
        title: '',
        description: '',
        startDate: selectedDate || toDateKey(new Date()),
        endDate: selectedDate || toDateKey(new Date()),
      });
    }
    setShowEventModal(true);
  };

  const handlePrevMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1));
  const handleNextMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1));

  const weekDays = lang === 'ja' ? ['日', '月', '火', '水', '木', '金', '土'] : ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">{t('internalCalendar')}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"
            aria-label="이전 달"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-lg font-semibold text-gray-800 min-w-[140px] text-center">
            {year}년 {month + 1}월
          </span>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"
            aria-label="다음 달"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
          <button
            onClick={() => handleOpenEventModal()}
            className="ml-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
          >
            {t('addEvent')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 text-xs font-semibold border-b border-gray-200 bg-gray-50">
          {weekDays.map((wd, wi) => (
            <div key={wd} className={`p-2 text-center ${wi === 0 || wi === 6 ? 'text-red-500' : 'text-gray-500'}`}>{wd}</div>
          ))}
        </div>
        <div className="divide-y divide-gray-100">
          {calendarGrid.map((row, ri) => (
            <div key={ri} className="grid grid-cols-7 min-h-[100px] sm:min-h-[120px]">
              {row.map((cell) => {
                const isToday = cell.date === toDateKey(new Date());
                const dayOfWeek = new Date(cell.date + 'T12:00:00').getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const isHoliday = holidayDateKeys.has(cell.date);
                const holidayName = holidayNameByDate[cell.date];
                const isRedDay = isWeekend || isHoliday;
                const dayEvents = eventsByDate[cell.date] || [];
                const dayLeaves = leaves[cell.date] || [];
                const dayMemos = memosByDate[cell.date] || [];
                const hasSharedMemo = dayMemos.some((m: any) => m.isShared);
                const hasPrivateMemo = dayMemos.some((m: any) => !m.isShared && m.userId === currentUserId);
                const dateColorClass = isToday
                  ? 'bg-blue-600 text-white'
                  : cell.isCurrentMonth
                    ? isRedDay
                      ? 'text-red-600'
                      : 'text-gray-800'
                    : isRedDay
                      ? 'text-red-400'
                      : 'text-gray-400';
                return (
                  <button
                    key={cell.date}
                    type="button"
                    onClick={() => setSelectedDate(cell.date)}
                    title={holidayName}
                    className={`p-2 text-left border-r border-gray-100 last:border-r-0 hover:bg-blue-50/50 transition-colors ${
                      !cell.isCurrentMonth ? 'bg-gray-50/50' : ''
                    } ${selectedDate === cell.date ? 'ring-2 ring-inset ring-blue-300' : ''}`}
                  >
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium ${dateColorClass}`}>
                      {cell.day}
                    </span>
                    {holidayName && cell.isCurrentMonth && (
                      <div className="text-[10px] text-red-500 truncate mt-0.5" title={holidayName}>{holidayName}</div>
                    )}
                    <div className="mt-1 space-y-0.5 overflow-hidden">
                      {dayEvents.slice(0, 2).map((e: any) => (
                        <div key={e.id} className="truncate text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                          {e.title}
                        </div>
                      ))}
                      {dayLeaves.slice(0, 2).map((l: any, i: number) => (
                        <div
                          key={i}
                          className={`truncate text-xs px-1.5 py-0.5 rounded ${
                            l.isOverseasWork ? 'bg-purple-100 text-purple-800' : 'bg-amber-100 text-amber-800'
                          }`}
                          title={l.type}
                        >
                          {l.userName} {l.isOverseasWork ? t('workOverseas') : t('onLeave')}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-xs text-gray-500">+{dayEvents.length - 2}</div>
                      )}
                      {hasSharedMemo && (
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title={t('sharedMemo')} />
                      )}
                      {hasPrivateMemo && (
                        <span className="inline-block w-2 h-2 rounded-full bg-blue-500" title={t('privateMemo')} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 메모·일정 미리보기 패널 - 캘린더 아래 공간 활용 */}
      <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[200px] sm:min-h-[240px]">
        {selectedDate ? (
          <div className="p-4 sm:p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString(locale, { month: 'long', day: 'numeric', weekday: 'long' })}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* 휴가 */}
              <div className="rounded-lg border border-gray-100 bg-amber-50/50 p-4">
                <h4 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  {t('onLeave')}
                </h4>
                {selectedLeaves.length > 0 ? (
                  <ul className="space-y-1.5 text-sm">
                    {selectedLeaves.map((l: any, i: number) => (
                      <li
                        key={i}
                        className={l.isOverseasWork ? 'text-purple-800' : 'text-amber-800'}
                      >
                        {l.userName} ({l.isOverseasWork ? t('workOverseas') : l.type})
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-amber-700/70">—</p>
                )}
              </div>
              {/* 일정 */}
              <div className="rounded-lg border border-gray-100 bg-blue-50/50 p-4">
                <h4 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  {t('eventsSchedule')}
                </h4>
                {selectedEvents.length > 0 ? (
                  <ul className="space-y-1.5 text-sm text-blue-800">
                    {selectedEvents.map((e: any) => (
                      <li key={e.id} className="flex items-center justify-between gap-2">
                        <span className="truncate min-w-0">{e.title}</span>
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEventModal(e)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            {t('edit')}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteEventMutation.mutate(e.id)}
                            disabled={deleteEventMutation.isPending}
                            className="text-xs text-red-600 hover:underline"
                          >
                            {t('delete')}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-blue-700/70">—</p>
                )}
              </div>
              {/* 메모 */}
              <div className="rounded-lg border border-gray-100 bg-emerald-50/50 p-4 sm:col-span-2 lg:col-span-1">
                <h4 className="text-sm font-semibold text-emerald-800 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {t('memo')}
                </h4>
                {selectedMemos.length > 0 ? (
                  <div className="space-y-2 max-h-[140px] overflow-y-auto">
                    {selectedMemos.map((m: any) => (
                      <div key={m.id} className="text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-emerald-800">{m.userName}</span>
                          <span className="text-emerald-700/80 text-xs">
                            ({m.isShared ? t('sharedMemo') : t('privateMemo')})
                          </span>
                          {m.userId === currentUserId && (
                            <div className="flex gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => { setEditMemo(m); setShowDateDetailModal(true); }}
                                className="text-xs text-emerald-700 hover:underline"
                              >
                                {t('edit')}
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteMemoMutation.mutate(m.id)}
                                disabled={deleteMemoMutation.isPending}
                                className="text-xs text-red-600 hover:underline"
                              >
                                {t('delete')}
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="mt-1 text-gray-700 whitespace-pre-wrap break-words line-clamp-3">{m.content || '—'}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-emerald-700/70">—</p>
                )}
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => { setEditMemo(null); setShowDateDetailModal(true); }}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    + {t('add')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 sm:p-12 flex flex-col items-center justify-center min-h-[200px] sm:min-h-[240px] text-center">
            <p className="text-gray-500 text-sm sm:text-base mb-4">{t('selectDateHint')}</p>
            {/* 이번 달 메모가 있는 날 요약 */}
            <div className="flex flex-wrap justify-center gap-2 max-w-md">
              {Object.entries(memosByDate)
                .filter(([, arr]) => arr.some((m: any) => m.isShared || m.userId === currentUserId))
                .slice(0, 12)
                .map(([date]) => (
                  <button
                    key={date}
                    type="button"
                    onClick={() => setSelectedDate(date)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                  >
                    {new Date(date + 'T12:00:00').getDate()}일
                  </button>
                ))}
            </div>
            {Object.keys(memosByDate).filter((d) => {
              const arr = memosByDate[d] || [];
              return arr.some((m: any) => m.isShared || m.userId === currentUserId);
            }).length === 0 && (
              <p className="text-gray-400 text-xs mt-2">{t('thisMonthMemos')} —</p>
            )}
          </div>
        )}
      </div>

      {/* 날짜 상세·메모 수정 모달 (패널에서 '메모 추가/수정' 클릭 시 열림) */}
      {selectedDate && showDateDetailModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => { setShowDateDetailModal(false); setEditMemo(null); }}>
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString(locale, { month: 'long', day: 'numeric', weekday: 'long' })}
              </h3>
              <button onClick={() => { setShowDateDetailModal(false); setEditMemo(null); }} className="p-2 -m-2 text-gray-500 hover:text-gray-700">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {selectedLeaves.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">{t('onLeave')}</h4>
                  <ul className="space-y-1">
                    {selectedLeaves.map((l: any, i: number) => (
                      <li
                        key={i}
                        className={`text-sm flex items-center gap-2 ${l.isOverseasWork ? 'text-purple-700' : 'text-amber-700'}`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${l.isOverseasWork ? 'bg-purple-500' : 'bg-amber-500'}`}
                        />
                        {l.userName} ({l.isOverseasWork ? t('workOverseas') : l.type})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedEvents.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">{t('eventTitle').replace(' 제목', '')}</h4>
                  <ul className="space-y-2">
                    {selectedEvents.map((e: any) => (
                      <li key={e.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-blue-50">
                        <span className="text-sm font-medium text-gray-800">{e.title}</span>
                        <div className="flex gap-1">
                          <button onClick={() => handleOpenEventModal(e)} className="text-xs text-blue-600 hover:underline">{t('edit')}</button>
                          <button onClick={() => deleteEventMutation.mutate(e.id)} className="text-xs text-red-600 hover:underline">{t('delete')}</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">{editMemo ? t('edit') : t('memo')}</h4>
                <MemoForm
                  date={selectedDate}
                  initialContent={editMemo?.content ?? ''}
                  initialIsShared={editMemo?.isShared ?? false}
                  onSave={(content, isShared) => {
                    if (editMemo) {
                      updateMemoMutation.mutate({ id: editMemo.id, content, isShared });
                    } else {
                      createMemoMutation.mutate({ date: selectedDate, content, isShared });
                    }
                  }}
                  onClose={() => { setShowDateDetailModal(false); setEditMemo(null); }}
                  t={t}
                  isPending={createMemoMutation.isPending || updateMemoMutation.isPending}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 일정 추가/수정 모달 */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">{editEvent ? t('edit') : t('addEvent')}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('eventTitle')}</label>
                <input
                  value={eventForm.title}
                  onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('eventTitle')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('reason')} <span className="text-gray-400">({t('optional')})</span></label>
                <textarea
                  value={eventForm.description}
                  onChange={(e) => setEventForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('startDate')}</label>
                  <input
                    type="date"
                    value={eventForm.startDate}
                    onChange={(e) => setEventForm((f) => ({ ...f, startDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('endDate')}</label>
                  <input
                    type="date"
                    value={eventForm.endDate}
                    onChange={(e) => setEventForm((f) => ({ ...f, endDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => { setShowEventModal(false); setEditEvent(null); }}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium"
              >
                {t('cancel')}
              </button>
              {editEvent ? (
                <button
                  onClick={() => updateEventMutation.mutate({ id: editEvent.id, data: eventForm })}
                  disabled={!eventForm.title || updateEventMutation.isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {updateEventMutation.isPending ? t('processing') : t('edit')}
                </button>
              ) : (
                <button
                  onClick={() => createEventMutation.mutate(eventForm)}
                  disabled={!eventForm.title || createEventMutation.isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {createEventMutation.isPending ? t('processing') : t('apply')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MemoForm({
  initialContent,
  initialIsShared,
  onSave,
  onClose,
  t,
  isPending,
}: {
  date: string;
  initialContent: string;
  initialIsShared: boolean;
  onSave: (content: string, isShared: boolean) => void;
  onClose: () => void;
  t: (k: TranslationKey) => string;
  isPending: boolean;
}) {
  const [content, setContent] = useState(initialContent);
  const [isShared, setIsShared] = useState(initialIsShared);

  return (
    <div className="space-y-3">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={t('memoPlaceholder')}
        rows={3}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" checked={isShared} onChange={() => setIsShared(true)} className="rounded-full" />
          <span className="text-sm">{t('sharedMemo')}</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" checked={!isShared} onChange={() => setIsShared(false)} className="rounded-full" />
          <span className="text-sm">{t('privateMemo')}</span>
        </label>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSave(content, isShared)}
          disabled={isPending}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
        >
          {isPending ? t('processing') : (initialContent ? t('edit') : t('add'))}
        </button>
        <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg">
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
