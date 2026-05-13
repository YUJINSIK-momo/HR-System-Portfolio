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

const EVENT_COLORS = [
  { bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-400' },
  { bg: 'bg-sky-100', text: 'text-sky-700', dot: 'bg-sky-400' },
  { bg: 'bg-teal-100', text: 'text-teal-700', dot: 'bg-teal-400' },
  { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-400' },
  { bg: 'bg-rose-100', text: 'text-rose-700', dot: 'bg-rose-400' },
];

function getEventColor(id: string) {
  const idx = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % EVENT_COLORS.length;
  return EVENT_COLORS[idx];
}

export default function CalendarPage() {
  const { t, lang } = useTranslation();
  const locale = lang === 'ja' ? 'ja-JP' : 'ko-KR';
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(() => toDateKey(new Date()));
  const [showEventModal, setShowEventModal] = useState(false);
  const [editEvent, setEditEvent] = useState<any>(null);
  const [editMemo, setEditMemo] = useState<any>(null);
  const [showMemoForm, setShowMemoForm] = useState(false);
  const [eventForm, setEventForm] = useState({ title: '', description: '', startDate: '', endDate: '' });

  const { year, month } = useMemo(() => ({
    year: viewDate.getFullYear(),
    month: viewDate.getMonth(),
  }), [viewDate]);

  const start = useMemo(() => toDateKey(new Date(year, month, 1)), [year, month]);
  const end = useMemo(() => toDateKey(new Date(year, month + 1, 0)), [year, month]);

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

  const safeHolidayRows = useMemo(() => {
    if (!Array.isArray(holidays)) return [];
    return holidays.filter((h): h is { date: string; name?: string | null } => {
      if (h == null || typeof h !== 'object') return false;
      const raw = (h as { date?: unknown }).date;
      return typeof raw === 'string' && raw.length > 0;
    });
  }, [holidays]);
  const holidayDateKeys = useMemo(() => new Set(safeHolidayRows.map((h) => String(h.date).slice(0, 10))), [safeHolidayRows]);
  const holidayNameByDate = useMemo(() => Object.fromEntries(safeHolidayRows.map((h) => [String(h.date).slice(0, 10), h.name ?? ''])), [safeHolidayRows]);

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
      currentRow.push({ date: toDateKey(new Date(year, month - 1, d)), day: d, isCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      currentRow.push({ date: toDateKey(new Date(year, month, d)), day: d, isCurrentMonth: true });
      if (currentRow.length === 7) { rows.push(currentRow); currentRow = []; }
    }
    const nextMonthStart = new Date(year, month + 1, 1);
    let pad = 1;
    while (currentRow.length < 7) {
      currentRow.push({ date: toDateKey(new Date(nextMonthStart.getFullYear(), nextMonthStart.getMonth(), pad)), day: pad, isCurrentMonth: false });
      pad++;
    }
    if (currentRow.length) rows.push(currentRow);
    return rows;
  }, [year, month]);

  const selectedMemos = selectedDate ? (memosByDate[selectedDate] || []) : [];
  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : [];
  const selectedLeaves = selectedDate ? ((leaves as any)[selectedDate] || []) : [];

  const createEventMutation = useMutation({
    mutationFn: (data: any) => api.post('/calendar/events', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['calendar'] }); setShowEventModal(false); setEditEvent(null); setEventForm({ title: '', description: '', startDate: '', endDate: '' }); },
  });
  const updateEventMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/calendar/events/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['calendar'] }); setShowEventModal(false); setEditEvent(null); },
  });
  const deleteEventMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/calendar/events/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar'] }),
  });
  const createMemoMutation = useMutation({
    mutationFn: ({ date, content, isShared }: { date: string; content: string; isShared: boolean }) => api.post('/calendar/memos', { date, content, isShared }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['calendar'] }); setShowMemoForm(false); setEditMemo(null); },
  });
  const updateMemoMutation = useMutation({
    mutationFn: ({ id, content, isShared }: { id: string; content: string; isShared: boolean }) => api.patch(`/calendar/memos/${id}`, { content, isShared }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['calendar'] }); setShowMemoForm(false); setEditMemo(null); },
  });
  const deleteMemoMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/calendar/memos/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar'] }),
  });

  const handleOpenEventModal = (ev?: any) => {
    if (ev) { setEditEvent(ev); setEventForm({ title: ev.title, description: ev.description || '', startDate: ev.startDate, endDate: ev.endDate }); }
    else { setEditEvent(null); setEventForm({ title: '', description: '', startDate: selectedDate || toDateKey(new Date()), endDate: selectedDate || toDateKey(new Date()) }); }
    setShowEventModal(true);
  };

  const weekDays = lang === 'ja' ? ['日', '月', '火', '水', '木', '金', '土'] : ['일', '월', '화', '수', '목', '금', '토'];

  const todayKey = toDateKey(new Date());
  const selectedDateObj = selectedDate ? new Date(selectedDate + 'T12:00:00') : null;
  const selectedIsHoliday = selectedDate ? holidayDateKeys.has(selectedDate) : false;
  const selectedHolidayName = selectedDate ? holidayNameByDate[selectedDate] : '';
  const selectedDayOfWeek = selectedDateObj?.getDay();
  const selectedIsWeekend = selectedDayOfWeek === 0 || selectedDayOfWeek === 6;

  // Upcoming events for the month (for sidebar hint)
  const upcomingEvents = useMemo(() => {
    return events
      .filter((e: any) => toDateKey(new Date(e.startDate)) >= todayKey)
      .sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 3);
  }, [events, todayKey]);

  const INPUT_CLS = 'w-full rounded-notion-btn border border-notion-hairline-strong bg-notion-canvas px-3 py-2 text-sm text-notion-charcoal focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent transition-all';

  return (
    <div className="min-h-full bg-notion-surface p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-notion-charcoal tracking-tight">{t('internalCalendar')}</h1>
          <p className="mt-0.5 text-sm text-notion-steel">일정, 휴가, 메모를 한눈에</p>
        </div>
        <button
          onClick={() => handleOpenEventModal()}
          className="inline-flex items-center gap-1.5 rounded-notion-btn bg-violet-700 hover:bg-violet-800 px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {t('addEvent')}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
        {/* ── Calendar Grid ── */}
        <div className="rounded-notion-card bg-notion-canvas border border-notion-hairline shadow-notion-subtle overflow-hidden">
          {/* Month navigation */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-notion-hairline">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-notion-btn border border-notion-hairline hover:bg-notion-surface transition-colors text-notion-slate"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="text-base font-semibold text-notion-charcoal tracking-tight min-w-[120px] text-center">
                {year}년 {month + 1}월
              </span>
              <button
                onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1))}
                className="flex h-8 w-8 items-center justify-center rounded-notion-btn border border-notion-hairline hover:bg-notion-surface transition-colors text-notion-slate"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
            <button
              onClick={() => { setViewDate(new Date()); setSelectedDate(todayKey); }}
              className="text-xs font-medium text-violet-700 hover:text-violet-900 border border-violet-200 bg-notion-tint-lavender px-3 py-1.5 rounded-notion-btn transition-colors"
            >
              오늘
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-notion-hairline-soft">
            {weekDays.map((wd, wi) => (
              <div key={wd} className={`py-2.5 text-center text-[11px] font-semibold tracking-widest uppercase ${
                wi === 0 ? 'text-rose-500' : wi === 6 ? 'text-sky-500' : 'text-notion-steel'
              }`}>
                {wd}
              </div>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="divide-y divide-notion-hairline-soft">
            {calendarGrid.map((row, ri) => (
              <div key={ri} className="grid grid-cols-7 min-h-[88px] sm:min-h-[108px]">
                {row.map((cell) => {
                  const isToday = cell.date === todayKey;
                  const isSelected = cell.date === selectedDate;
                  const dayOfWeek = new Date(cell.date + 'T12:00:00').getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  const isHoliday = holidayDateKeys.has(cell.date);
                  const isRedDay = isWeekend || isHoliday;
                  const holidayName = holidayNameByDate[cell.date];
                  const dayEvents = eventsByDate[cell.date] || [];
                  const dayLeaves = (leaves as any)[cell.date] || [];
                  const dayMemos = memosByDate[cell.date] || [];
                  const hasSharedMemo = dayMemos.some((m: any) => m.isShared);
                  const hasPrivateMemo = dayMemos.some((m: any) => !m.isShared && m.userId === currentUserId);

                  return (
                    <button
                      key={cell.date}
                      type="button"
                      onClick={() => setSelectedDate(cell.date)}
                      className={`p-2 text-left border-r border-notion-hairline-soft last:border-r-0 transition-colors ${
                        !cell.isCurrentMonth
                          ? 'bg-notion-surface/50'
                          : isRedDay
                          ? 'bg-rose-50/30'
                          : ''
                      } ${isSelected ? 'ring-2 ring-inset ring-violet-400 bg-notion-tint-lavender/40' : 'hover:bg-notion-surface'}`}
                    >
                      {/* Date number */}
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-sm font-medium leading-none ${
                        isToday
                          ? 'bg-violet-600 text-white font-semibold'
                          : !cell.isCurrentMonth
                          ? isRedDay ? 'text-rose-300' : 'text-notion-muted'
                          : isRedDay
                          ? 'text-rose-500'
                          : 'text-notion-charcoal'
                      }`}>
                        {cell.day}
                      </span>

                      {/* Holiday name */}
                      {holidayName && cell.isCurrentMonth && (
                        <div className="text-[9px] text-rose-500 truncate mt-0.5 leading-tight">{holidayName}</div>
                      )}

                      {/* Events */}
                      <div className="mt-1 space-y-0.5 overflow-hidden">
                        {dayEvents.slice(0, 2).map((e: any) => {
                          const col = getEventColor(e.id);
                          return (
                            <div key={e.id} className={`truncate text-[10px] font-medium ${col.bg} ${col.text} px-1.5 py-0.5 rounded-sm leading-tight`}>
                              {e.title}
                            </div>
                          );
                        })}
                        {dayLeaves.slice(0, 1).map((l: any, i: number) => (
                          <div key={i} className="truncate text-[10px] font-medium bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-sm leading-tight">
                            {l.userName} 휴가
                          </div>
                        ))}
                        {dayEvents.length + dayLeaves.length > 3 && (
                          <div className="text-[9px] text-notion-steel pl-0.5">+{dayEvents.length + dayLeaves.length - 3}개</div>
                        )}
                        {/* Memo dots */}
                        <div className="flex gap-1 mt-0.5">
                          {hasSharedMemo && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                          {hasPrivateMemo && <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="px-5 py-3 border-t border-notion-hairline-soft flex flex-wrap gap-x-5 gap-y-1.5">
            <span className="flex items-center gap-1.5 text-[11px] text-notion-steel">
              <span className="w-2 h-2 rounded-full bg-violet-400" />일정
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-notion-steel">
              <span className="w-2 h-2 rounded-full bg-amber-400" />휴가
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-notion-steel">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />공유 메모
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-notion-steel">
              <span className="w-2 h-2 rounded-full bg-sky-400" />개인 메모
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-notion-steel">
              <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-violet-600 text-white text-[9px] font-semibold">1</span>오늘
            </span>
          </div>
        </div>

        {/* ── Side Panel ── */}
        <div className="space-y-4">
          {/* Selected date detail */}
          <div className="rounded-notion-card bg-notion-canvas border border-notion-hairline shadow-notion-subtle overflow-hidden">
            {selectedDate && selectedDateObj ? (
              <>
                {/* Date header */}
                <div className={`px-4 py-4 border-b border-notion-hairline ${
                  selectedIsHoliday || selectedIsWeekend ? 'bg-rose-50' : 'bg-notion-surface'
                }`}>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-notion-steel mb-0.5">
                    {selectedIsHoliday ? selectedHolidayName || '공휴일' : '선택된 날짜'}
                  </p>
                  <p className="text-lg font-semibold text-notion-charcoal tracking-tight">
                    {selectedDateObj.toLocaleDateString(locale, { month: 'long', day: 'numeric', weekday: 'long' })}
                  </p>
                </div>

                <div className="p-4 space-y-4">
                  {/* Leaves */}
                  <div>
                    <h4 className="text-[11px] font-semibold uppercase tracking-widest text-notion-steel mb-2 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      {t('onLeave')}
                    </h4>
                    {selectedLeaves.length > 0 ? (
                      <ul className="space-y-1.5">
                        {selectedLeaves.map((l: any, i: number) => (
                          <li key={i} className="flex items-center gap-2 rounded-notion-btn bg-amber-50 border border-amber-100 px-3 py-2">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-200 text-[10px] font-bold text-amber-800">
                              {l.userName?.charAt(0)}
                            </div>
                            <span className="text-sm text-amber-900 font-medium">{l.userName}</span>
                            <span className="ml-auto text-xs text-amber-600">{l.isOverseasWork ? t('workOverseas') : l.type || t('onLeave')}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-notion-muted py-1">휴가자 없음</p>
                    )}
                  </div>

                  {/* Events */}
                  <div>
                    <h4 className="text-[11px] font-semibold uppercase tracking-widest text-notion-steel mb-2 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                      {t('eventsSchedule')}
                    </h4>
                    {selectedEvents.length > 0 ? (
                      <ul className="space-y-1.5">
                        {selectedEvents.map((e: any) => {
                          const col = getEventColor(e.id);
                          return (
                            <li key={e.id} className={`flex items-start gap-2 rounded-notion-btn ${col.bg} border border-transparent px-3 py-2`}>
                              <span className={`mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full ${col.dot}`} />
                              <span className={`text-sm font-medium flex-1 min-w-0 truncate ${col.text}`}>{e.title}</span>
                              <div className="flex gap-2 shrink-0">
                                <button onClick={() => handleOpenEventModal(e)} className={`text-[11px] font-medium ${col.text} hover:underline`}>{t('edit')}</button>
                                <button onClick={() => deleteEventMutation.mutate(e.id)} className="text-[11px] font-medium text-rose-500 hover:underline">{t('delete')}</button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-xs text-notion-muted py-1">등록된 일정 없음</p>
                    )}
                    <button
                      onClick={() => handleOpenEventModal()}
                      className="mt-2 text-xs font-medium text-violet-700 hover:text-violet-900 transition-colors"
                    >
                      + 일정 추가
                    </button>
                  </div>

                  {/* Memos */}
                  <div>
                    <h4 className="text-[11px] font-semibold uppercase tracking-widest text-notion-steel mb-2 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {t('memo')}
                    </h4>
                    {selectedMemos.length > 0 ? (
                      <div className="space-y-2 mb-2">
                        {selectedMemos.map((m: any) => (
                          <div key={m.id} className="rounded-notion-btn bg-notion-surface border border-notion-hairline px-3 py-2.5">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-xs font-semibold text-notion-charcoal">{m.userName}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${m.isShared ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>
                                {m.isShared ? '공유' : '개인'}
                              </span>
                            </div>
                            <p className="text-sm text-notion-slate whitespace-pre-wrap break-words line-clamp-3">{m.content || '—'}</p>
                            {m.userId === currentUserId && (
                              <div className="flex gap-2 mt-1.5">
                                <button onClick={() => { setEditMemo(m); setShowMemoForm(true); }} className="text-[11px] font-medium text-violet-700 hover:underline">{t('edit')}</button>
                                <button onClick={() => deleteMemoMutation.mutate(m.id)} className="text-[11px] font-medium text-rose-500 hover:underline">{t('delete')}</button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-notion-muted py-1 mb-2">메모 없음</p>
                    )}
                    {!showMemoForm ? (
                      <button
                        onClick={() => { setEditMemo(null); setShowMemoForm(true); }}
                        className="text-xs font-medium text-violet-700 hover:text-violet-900 transition-colors"
                      >
                        + 메모 추가
                      </button>
                    ) : (
                      <MemoForm
                        date={selectedDate}
                        initialContent={editMemo?.content ?? ''}
                        initialIsShared={editMemo?.isShared ?? false}
                        onSave={(content, isShared) => {
                          if (editMemo) { updateMemoMutation.mutate({ id: editMemo.id, content, isShared }); }
                          else { createMemoMutation.mutate({ date: selectedDate, content, isShared }); }
                        }}
                        onClose={() => { setShowMemoForm(false); setEditMemo(null); }}
                        t={t}
                        isPending={createMemoMutation.isPending || updateMemoMutation.isPending}
                      />
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="p-6 flex flex-col items-center justify-center text-center min-h-[200px]">
                <div className="flex h-10 w-10 items-center justify-center rounded-notion-card bg-notion-tint-lavender border border-violet-100 mb-3">
                  <svg className="w-5 h-5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm text-notion-steel">{t('selectDateHint')}</p>
              </div>
            )}
          </div>

          {/* Upcoming events this month */}
          {upcomingEvents.length > 0 && (
            <div className="rounded-notion-card bg-notion-canvas border border-notion-hairline shadow-notion-subtle p-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-notion-steel mb-3">
                이번 달 예정 일정
              </h3>
              <ul className="space-y-2">
                {upcomingEvents.map((e: any) => {
                  const col = getEventColor(e.id);
                  return (
                    <li
                      key={e.id}
                      onClick={() => setSelectedDate(toDateKey(new Date(e.startDate)))}
                      className="flex items-center gap-2.5 cursor-pointer rounded-notion-btn hover:bg-notion-surface px-2 py-2 transition-colors"
                    >
                      <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${col.dot}`} />
                      <span className="text-sm font-medium text-notion-charcoal truncate flex-1">{e.title}</span>
                      <span className="text-[11px] text-notion-steel shrink-0">
                        {new Date(e.startDate + 'T12:00:00').toLocaleDateString(locale, { month: 'numeric', day: 'numeric' })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-notion-navy/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-notion-canvas rounded-notion-card w-full max-w-md shadow-notion-modal border border-notion-hairline p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-notion-charcoal">{editEvent ? t('edit') : t('addEvent')}</h3>
              <button onClick={() => { setShowEventModal(false); setEditEvent(null); }} className="text-notion-steel hover:text-notion-charcoal">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-notion-steel mb-1.5 uppercase tracking-widest">{t('eventTitle')}</label>
                <input value={eventForm.title} onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))} className={INPUT_CLS} placeholder={t('eventTitle')} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-notion-steel mb-1.5 uppercase tracking-widest">설명 (선택)</label>
                <textarea value={eventForm.description} onChange={(e) => setEventForm((f) => ({ ...f, description: e.target.value }))} rows={2} className={`${INPUT_CLS} resize-none`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-notion-steel mb-1.5 uppercase tracking-widest">{t('startDate')}</label>
                  <input type="date" value={eventForm.startDate} onChange={(e) => setEventForm((f) => ({ ...f, startDate: e.target.value }))} className={INPUT_CLS} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-notion-steel mb-1.5 uppercase tracking-widest">{t('endDate')}</label>
                  <input type="date" value={eventForm.endDate} onChange={(e) => setEventForm((f) => ({ ...f, endDate: e.target.value }))} className={INPUT_CLS} />
                </div>
              </div>
            </div>
            <div className="flex gap-2.5 mt-5">
              <button onClick={() => { setShowEventModal(false); setEditEvent(null); }} className="flex-1 rounded-notion-btn border border-notion-hairline-strong py-2.5 text-sm font-medium text-notion-slate hover:bg-notion-surface transition-colors">{t('cancel')}</button>
              {editEvent ? (
                <button onClick={() => updateEventMutation.mutate({ id: editEvent.id, data: eventForm })} disabled={!eventForm.title || updateEventMutation.isPending} className="flex-1 rounded-notion-btn bg-violet-700 hover:bg-violet-800 py-2.5 text-sm font-semibold text-white disabled:opacity-40 transition-colors">
                  {updateEventMutation.isPending ? t('processing') : t('edit')}
                </button>
              ) : (
                <button onClick={() => createEventMutation.mutate(eventForm)} disabled={!eventForm.title || createEventMutation.isPending} className="flex-1 rounded-notion-btn bg-violet-700 hover:bg-violet-800 py-2.5 text-sm font-semibold text-white disabled:opacity-40 transition-colors">
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
  initialContent, initialIsShared, onSave, onClose, t, isPending,
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
    <div className="space-y-2.5 pt-1">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={t('memoPlaceholder')}
        rows={3}
        className="w-full rounded-notion-btn border border-notion-hairline-strong bg-notion-canvas px-3 py-2 text-sm text-notion-charcoal placeholder:text-notion-muted focus:outline-none focus:ring-2 focus:ring-violet-600 resize-none"
      />
      <div className="flex gap-3">
        {[{ label: t('sharedMemo'), value: true }, { label: t('privateMemo'), value: false }].map(({ label, value }) => (
          <label key={String(value)} className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" checked={isShared === value} onChange={() => setIsShared(value)} className="accent-violet-600" />
            <span className="text-xs text-notion-slate">{label}</span>
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={() => onSave(content, isShared)} disabled={isPending} className="rounded-notion-btn bg-violet-700 hover:bg-violet-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 transition-colors">
          {isPending ? t('processing') : (initialContent ? t('edit') : t('add'))}
        </button>
        <button onClick={onClose} className="rounded-notion-btn border border-notion-hairline-strong px-3 py-1.5 text-xs font-medium text-notion-slate hover:bg-notion-surface transition-colors">
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
