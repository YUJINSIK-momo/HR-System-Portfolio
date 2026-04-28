import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ko, ja } from 'date-fns/locale';
import api from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';

const PROJECT_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];

function getDaysInMonth(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const days: Date[] = [];
  const d = new Date(first);
  while (d <= last) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

/** 간트 차트용: 현재 월 + 다음 월 (오른쪽 여백 채움) */
function getDaysForGantt(year: number, month: number) {
  const currentMonth = getDaysInMonth(year, month);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextMonthDays = getDaysInMonth(nextYear, nextMonth);
  return [...currentMonth, ...nextMonthDays];
}

function toYMD(d: Date) {
  return d.toISOString().slice(0, 10);
}

type PersonalTodoRow = { id: string; title: string; done: boolean };

function formatDateForApi(d: Date | null): string {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function SchedulePage() {
  const { t, lang } = useTranslation();
  const dateLocale = lang === 'ja' ? ja : ko;
  const queryClient = useQueryClient();
  const today = new Date();
  const [activeTab, setActiveTab] = useState<'list' | 'gantt' | 'completed' | 'todo'>('list');
  const [newTodoText, setNewTodoText] = useState('');
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingTodoText, setEditingTodoText] = useState('');
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editTask, setEditTask] = useState<any>(null);
  const [editProject, setEditProject] = useState<any>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectForm, setProjectForm] = useState({ name: '', description: '', color: PROJECT_COLORS[0] });
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    projectId: '',
    startDate: '',
    endDate: '',
    status: 'TODO' as 'TODO' | 'IN_PROGRESS' | 'DONE',
    priority: 'MEDIUM' as const,
    assigneeIds: [] as string[],
  });
  const [ganttProjectFilter, setGanttProjectFilter] = useState<string | null>(null);
  const [ganttAssigneeFilter, setGanttAssigneeFilter] = useState('');
  const [completedProjectFilter, setCompletedProjectFilter] = useState<string | null>(null);
  const [completedAssigneeFilter, setCompletedAssigneeFilter] = useState('');

  const { data: allProjects = [] } = useQuery({
    queryKey: ['schedule', 'projects', year],
    queryFn: () => api.get(`/schedule/projects?year=${year}`).then((r) => r.data),
  });

  const { activeProjects, completedProjects } = useMemo(() => {
    const tasks = (p: any) => p.tasks || [];
    const is100 = (p: any) => {
      const t = tasks(p);
      return t.length > 0 && t.every((x: any) => x.status === 'DONE');
    };
    return {
      activeProjects: allProjects.filter((p: any) => !is100(p)),
      completedProjects: allProjects.filter((p: any) => is100(p)),
    };
  }, [allProjects]);

  const { data: assignableUsers = [] } = useQuery({
    queryKey: ['schedule', 'assignable-users'],
    queryFn: () => api.get('/schedule/assignable-users').then((r) => r.data),
  });

  const { data: taskFormHolidays = [] } = useQuery({
    queryKey: ['holidays', 'task-form'],
    queryFn: async () => {
      const res = await api.get('/holidays', {
        params: { start: '2024-01-01', end: '2027-12-31' },
      });
      return res.data;
    },
  });

  const taskFormHighlightDates = useMemo(
    () => (taskFormHolidays || []).map((h: { date: string }) => {
      const [y, m, d] = String(h.date).slice(0, 10).split('-').map(Number);
      return new Date(y, (m || 1) - 1, d || 1);
    }),
    [taskFormHolidays]
  );

  const ganttEndYear = month === 12 ? year + 1 : year;
  const ganttEndMonth = month === 12 ? 1 : month + 1;
  const holidayStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const holidayEnd = `${ganttEndYear}-${String(ganttEndMonth).padStart(2, '0')}-${new Date(ganttEndYear, ganttEndMonth, 0).getDate()}`;
  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays', holidayStart, holidayEnd],
    queryFn: () => api.get('/holidays', { params: { start: holidayStart, end: holidayEnd } }).then((r) => r.data),
  });
  const { data: approvedLeaves = [] } = useQuery({
    queryKey: ['leave', 'approved-for-schedule', holidayStart, holidayEnd],
    queryFn: () => api.get('/leave/approved-for-schedule', { params: { start: holidayStart, end: holidayEnd } }).then((r) => r.data),
  });

  const createProjectMutation = useMutation({
    mutationFn: (data: any) => api.post('/schedule/projects', { ...data, year }).then((r) => r.data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['schedule', 'projects', year] });
      await queryClient.refetchQueries({ queryKey: ['schedule', 'projects', year] });
      setShowProjectForm(false);
      setProjectForm({ name: '', description: '', color: PROJECT_COLORS[0] });
      setEditProject(null);
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/schedule/projects/${id}`, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['schedule', 'projects', year] });
      await queryClient.refetchQueries({ queryKey: ['schedule', 'projects', year] });
      setShowProjectForm(false);
      setEditProject(null);
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/schedule/projects/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['schedule', 'projects', year] });
      await queryClient.refetchQueries({ queryKey: ['schedule', 'projects', year] });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: (data: any) => api.post('/schedule/tasks', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      setShowTaskForm(false);
      resetTaskForm();
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/schedule/tasks/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      setShowTaskForm(false);
      setEditTask(null);
      resetTaskForm();
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/schedule/tasks/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedule'] }),
  });

  const { data: personalTodos = [] } = useQuery({
    queryKey: ['schedule', 'personal-todos'],
    queryFn: () => api.get('/schedule/personal-todos').then((r) => r.data),
  });

  const createPersonalTodoMutation = useMutation({
    mutationFn: (title: string) => api.post('/schedule/personal-todos', { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', 'personal-todos'] });
      setNewTodoText('');
    },
  });

  const updatePersonalTodoMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { title?: string; done?: boolean } }) =>
      api.patch(`/schedule/personal-todos/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', 'personal-todos'] });
      setEditingTodoId(null);
    },
  });

  const deletePersonalTodoMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/schedule/personal-todos/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedule', 'personal-todos'] }),
  });

  const clearDonePersonalTodosMutation = useMutation({
    mutationFn: async () => {
      const res = await api.get('/schedule/personal-todos');
      const doneIds = (res.data as { id: string; done: boolean }[])
        .filter((x) => x.done)
        .map((x) => x.id);
      await Promise.all(doneIds.map((id) => api.delete(`/schedule/personal-todos/${id}`)));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedule', 'personal-todos'] }),
  });

  const todoActiveCount = useMemo(
    () => (personalTodos as PersonalTodoRow[]).filter((x) => !x.done).length,
    [personalTodos]
  );

  const todoActiveItems = useMemo(
    () => (personalTodos as PersonalTodoRow[]).filter((x) => !x.done),
    [personalTodos]
  );
  const todoDoneItems = useMemo(
    () => (personalTodos as PersonalTodoRow[]).filter((x) => x.done),
    [personalTodos]
  );

  function resetTaskForm() {
    setTaskForm({
      title: '',
      description: '',
      projectId: selectedProjectId || '',
      startDate: '',
      endDate: '',
      status: 'TODO',
      priority: 'MEDIUM',
      assigneeIds: [],
    });
  }

  const days = useMemo(() => getDaysForGantt(year, month), [year, month]);
  const viewStart = days[0] ? new Date(days[0]) : new Date(year, month - 1, 1);
  const viewEnd = days.length > 0 ? new Date(days[days.length - 1]) : new Date(year, month - 1, 28);
  const totalMs = viewEnd.getTime() - viewStart.getTime();
  const totalDays = Math.ceil(totalMs / (24 * 60 * 60 * 1000)) + 1;

  const CELL_WIDTH = 36;

  const viewEndMs = viewEnd.getTime();
  const viewStartMs = viewStart.getTime();

  /** 선택한 년·월에 해당하는 태스크만 간트에 표시 (기간 있으면 겹칠 때만, 없으면 표시) */
  function taskVisibleInGantt(task: any): boolean {
    const start = task.startDate ? new Date(task.startDate) : null;
    const end = task.endDate ? new Date(task.endDate) : null;
    if (!start || !end) return true; // 기간 미설정 → "기간 미설정"으로 표시
    const startMs = start.getTime();
    const endMs = end.getTime();
    return !(endMs < viewStartMs || startMs > viewEndMs); // 보는 월과 겹치면 표시
  }

  const DAY_MS = 24 * 60 * 60 * 1000;

  function getBarStyle(task: any) {
    const status = task.status || 'TODO';
    const statusColors: Record<string, string> = { TODO: '#9CA3AF', IN_PROGRESS: task.projectColor || '#3B82F6', DONE: '#10B981' };
    const color = statusColors[status] || task.projectColor || '#3B82F6';
    const start = task.startDate ? new Date(task.startDate) : null;
    const end = task.endDate ? new Date(task.endDate) : null;
    if (!start || !end || totalDays <= 0) return null;
    const startMs = start.getTime();
    const endMs = end.getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return null;
    if (endMs < viewStartMs || startMs > viewEndMs) return null;
    const left = Math.max(0, (startMs - viewStartMs) / DAY_MS);
    const viewSpanEnd = Math.min(endMs, viewEndMs);
    const viewSpanStart = Math.max(startMs, viewStartMs);
    const widthDays = (viewSpanEnd - viewSpanStart) / DAY_MS + 1;
    if (widthDays <= 0 || !Number.isFinite(widthDays)) return null;
    const leftPx = Math.max(0, Math.min(left * CELL_WIDTH, totalDays * CELL_WIDTH - 60));
    const widthPx = Math.max(60, Math.min(widthDays * CELL_WIDTH, totalDays * CELL_WIDTH));
    return { leftPx, widthPx, color, status };
  }

  const STATUS_LABELS: Record<string, 'statusTodo' | 'statusInProgress' | 'statusDone'> = { TODO: 'statusTodo', IN_PROGRESS: 'statusInProgress', DONE: 'statusDone' };

  const holidaySet = useMemo(() => new Set((holidays || []).map((h: { date: string }) => String(h.date).slice(0, 10))), [holidays]);

  const hasAssignee = (task: any, userId: string) => {
    const ids = task.assigneeIds || (task.assigneeId ? [task.assigneeId] : []);
    return ids.includes(userId);
  };

  const assigneeIdsInView = useMemo(() => {
    const ids = new Set<string>();
    const projs = ganttProjectFilter ? activeProjects.filter((p: any) => p.id === ganttProjectFilter) : activeProjects;
    projs.forEach((p: any) => (p.tasks || []).forEach((t: any) => {
      if (ganttAssigneeFilter && !hasAssignee(t, ganttAssigneeFilter)) return;
      const arr = t.assigneeIds || (t.assigneeId ? [t.assigneeId] : []);
      arr.forEach((id: string) => ids.add(id));
    }));
    return ids;
  }, [activeProjects, ganttProjectFilter, ganttAssigneeFilter]);

  const leavesByDate = useMemo(() => {
    const map = new Map<string, { userId: string; userName: string; type: string }[]>();
    (approvedLeaves || []).forEach((l: any) => {
      if (!assigneeIdsInView.has(l.userId)) return;
      const start = new Date(l.startDate);
      const end = new Date(l.endDate);
      let d = new Date(start);
      while (d <= end) {
        const key = toYMD(d);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({ userId: l.userId, userName: l.userName, type: l.type });
        d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
      }
    });
    return map;
  }, [approvedLeaves, assigneeIdsInView]);

  const handleOpenTaskForm = (projectId?: string, task?: any) => {
    if (task) {
      setEditTask(task);
      setTaskForm({
        title: task.title,
        description: task.description || '',
        projectId: task.projectId || projectId || '',
        startDate: task.startDate || '',
        endDate: task.endDate || '',
        status: task.status || 'TODO',
        priority: task.priority || 'MEDIUM',
        assigneeIds: task.assigneeIds && task.assigneeIds.length > 0 ? task.assigneeIds : (task.assigneeId ? [task.assigneeId] : []),
      });
    } else {
      setEditTask(null);
      setSelectedProjectId(projectId || null);
      setTaskForm({
        title: '',
        description: '',
        projectId: projectId || '',
        startDate: '',
        endDate: '',
        status: 'TODO',
        priority: 'MEDIUM',
        assigneeIds: [],
      });
    }
    setShowTaskForm(true);
  };

  const handleOpenProjectForm = (project?: any) => {
    if (project) {
      setEditProject(project);
      setProjectForm({
        name: project.name,
        description: project.description || '',
        color: project.color || PROJECT_COLORS[0],
      });
    } else {
      setEditProject(null);
      setProjectForm({ name: '', description: '', color: PROJECT_COLORS[0] });
    }
    setShowProjectForm(true);
  };

  const toggleExpand = (id: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-full bg-slate-50 p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t('scheduleMgmt')}</h2>
          <p className="mt-1 text-sm text-slate-500">프로젝트 및 개인 일정을 관리합니다</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleOpenProjectForm()}
            className="px-4 py-2.5 border border-slate-200 bg-white text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 shadow-sm transition"
          >
            {t('addProject')}
          </button>
          <button
            onClick={() => handleOpenTaskForm(activeProjects[0]?.id)}
            disabled={activeProjects.length === 0}
            className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-200 disabled:opacity-50 transition"
          >
            {t('addTask')}
          </button>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-6">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          {t('scheduleTabList')}
        </button>
        <button
          onClick={() => setActiveTab('gantt')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'gantt' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          {t('scheduleTabGantt')}
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'completed' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          {t('scheduleTabCompleted')}
          {completedProjects.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs">
              {completedProjects.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('todo')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'todo' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          {t('scheduleTabTodo')}
          {todoActiveCount > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs tabular-nums">
              {todoActiveCount}
            </span>
          )}
        </button>
      </div>

      {/* 목록 관리 탭 */}
      {activeTab === 'list' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">{year}{t('year')}</span>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {[year - 2, year - 1, year, year + 1, year + 2].map((y) => (
                  <option key={y} value={y}>{y}{t('year')}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {activeProjects.length === 0 ? (
              <div className="py-16 text-center text-gray-500">
                <p className="mb-4">{t('noProjects')}</p>
                <button onClick={() => handleOpenProjectForm()} className="text-blue-600 hover:underline font-medium">
                  {t('addProject')}
                </button>
              </div>
            ) : (
              activeProjects.map((project: any, pi: number) => (
                <div key={project.id} className="p-4">
                  <div
                    className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-4 px-4 py-2 rounded-lg"
                    onClick={() => toggleExpand(project.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                        style={{ backgroundColor: project.color || PROJECT_COLORS[pi % PROJECT_COLORS.length] }}
                      >
                        {String.fromCharCode(65 + pi)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{project.name}</p>
                        {project.description && <p className="text-xs text-gray-500">{project.description}</p>}
                      </div>
                      <span className="text-xs text-gray-400">
                        {(project.tasks || []).length} {t('count')}
                        {' · '}
                        <span className="font-medium text-blue-600">
                          {((project.tasks || []).length > 0
                            ? Math.round(((project.tasks || []).filter((t: any) => t.status === 'DONE').length / (project.tasks || []).length) * 100)
                            : 0)}%
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => handleOpenTaskForm(project.id)} className="text-sm text-blue-600 hover:underline">
                        + {t('addTask')}
                      </button>
                      <button onClick={() => handleOpenProjectForm(project)} className="text-sm text-gray-500 hover:underline">
                        {t('edit')}
                      </button>
                      <button onClick={() => window.confirm(t('deleteConfirm')) && deleteProjectMutation.mutate(project.id)} className="text-sm text-red-500 hover:underline">
                        {t('delete')}
                      </button>
                      <svg className={`w-5 h-5 text-gray-400 transition-transform ${expandedProjects.has(project.id) ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  {expandedProjects.has(project.id) && (project.tasks || []).length > 0 && (
                    <div className="mt-3 ml-12 space-y-2 border-l-2 border-gray-200 pl-4">
                      {(project.tasks || []).map((task: any) => (
                        <div key={task.id} className="flex items-center justify-between py-2">
                          <div>
                            <p className="font-medium text-gray-800">{task.title}</p>
                            <div className="flex gap-2 text-xs text-gray-500 mt-0.5">
                              {task.startDate && task.endDate && <span>{task.startDate} ~ {task.endDate}</span>}
                              {((task.assigneeNames?.length ? task.assigneeNames : task.assigneeName ? [task.assigneeName] : []) as string[]).length > 0 && (
                                <span>@{(task.assigneeNames?.length ? task.assigneeNames : [task.assigneeName]).join(', ')}</span>
                              )}
                              <span>{t(STATUS_LABELS[task.status as string] ?? 'statusTodo')}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleOpenTaskForm(project.id, task)} className="text-xs text-blue-600 hover:underline">{t('edit')}</button>
                            <button onClick={() => window.confirm(t('deleteConfirm')) && deleteTaskMutation.mutate(task.id)} className="text-xs text-red-500 hover:underline">{t('delete')}</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 간트 차트 탭 */}
      {activeTab === 'gantt' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 bg-white rounded-lg border border-gray-200 px-4 py-3">
            <span className="text-sm font-medium text-gray-700">{year}{t('year')}</span>
            <select value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {[year - 2, year - 1, year, year + 1, year + 2].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button onClick={() => setMonth((m) => Math.max(1, m - 1))} className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm">{t('prevMonth')}</button>
            <span className="px-3 text-sm font-medium">{month}월</span>
            <button onClick={() => setMonth((m) => Math.min(12, m + 1))} className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm">{t('nextMonth')}</button>
            <select
              value={ganttProjectFilter ?? ''}
              onChange={(e) => setGanttProjectFilter(e.target.value || null)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[140px]"
            >
              <option value="">{t('allProjects')}</option>
              {activeProjects.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              value={ganttAssigneeFilter}
              onChange={(e) => setGanttAssigneeFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[140px]"
            >
              <option value="">{t('assignee')}</option>
              {assignableUsers.map((u: any) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex overflow-x-auto">
          {/* 좌측 사이드바 */}
          <div className="w-72 shrink-0 border-r border-gray-200 bg-gray-50/50">
            <div className="h-12 border-b border-gray-200 flex items-center px-4 font-semibold text-gray-700 text-sm">
              {t('projectOrTask')}
            </div>
            <div className="divide-y divide-gray-100">
              {(ganttProjectFilter ? activeProjects.filter((p: any) => p.id === ganttProjectFilter) : activeProjects).length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-sm">
                  {t('noProjects')}
                  <button
                    onClick={() => handleOpenProjectForm()}
                    className="ml-2 text-blue-600 hover:underline"
                  >
                    {t('addProject')}
                  </button>
                </div>
              ) : (
                (ganttProjectFilter ? activeProjects.filter((p: any) => p.id === ganttProjectFilter) : activeProjects)
                  .map((project: any, pi: number) => {
                    const filteredTasks = (project.tasks || []).filter(
                      (t: any) => (!ganttAssigneeFilter || hasAssignee(t, ganttAssigneeFilter)) && taskVisibleInGantt(t)
                    );
                    if (filteredTasks.length === 0) return null;
                    return (
                    <div key={project.id}>
                    {/* 태스크만 표시 (프로젝트 행 없음), 프로젝트 진행률은 목록 탭에서 확인 */}
                    {filteredTasks.map((task: any) => (
                        <div
                          key={task.id}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-white/80 border-b border-gray-50 last:border-b-0"
                          style={{ minHeight: 56 }}
                        >
                          <div
                            className="w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: project.color || PROJECT_COLORS[pi % PROJECT_COLORS.length] }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-gray-800 text-sm truncate">{task.title}</p>
                            {task.description && (
                              <p className="text-xs text-gray-500 truncate">{task.description}</p>
                            )}
                            <div className="flex gap-2 text-xs mt-0.5">
                              <span className="text-gray-400 truncate">{project.name}</span>
                              {((task.assigneeNames?.length ? task.assigneeNames : task.assigneeName ? [task.assigneeName] : []) as string[]).length > 0 && (
                                <span className="text-blue-600 truncate">
                                  @{(task.assigneeNames?.length ? task.assigneeNames : [task.assigneeName]).join(', ')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => handleOpenTaskForm(project.id, task)}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              {t('edit')}
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(t('deleteConfirm'))) deleteTaskMutation.mutate(task.id);
                              }}
                              className="text-xs text-red-600 hover:underline"
                            >
                              {t('delete')}
                            </button>
                          </div>
                        </div>
                    ))}
                  </div>
                );
                })
              )}
            </div>
          </div>

          {/* 우측 타임라인 */}
          <div className="flex-1 min-w-0">
            <div className="h-12 border-b border-gray-200 flex" style={{ minWidth: totalDays * CELL_WIDTH }}>
              {days.map((d, idx) => {
                const dow = d.getDay();
                const ymd = toYMD(d);
                const isWeekend = dow === 0 || dow === 6;
                const isHoliday = holidaySet.has(ymd);
                const isRed = isWeekend || isHoliday;
                const isNewMonth = d.getDate() === 1 && idx > 0; // 다음 달 구분
                const dayLeaves = leavesByDate.get(ymd) || [];
                const leaveTitle = dayLeaves.length > 0 ? dayLeaves.map((l) => `${l.userName} 연차`).join(', ') : '';
                const tooltip = [isHoliday ? (holidays?.find((h: { date: string }) => h.date === ymd)?.name || '공휴일') : null, isWeekend ? '주말' : null, leaveTitle].filter(Boolean).join(' · ');
                return (
                  <div
                    key={ymd}
                    className={`shrink-0 border-r border-gray-100 flex flex-col items-center justify-center py-1 ${isRed ? 'bg-red-50' : ''} ${isNewMonth ? 'border-l-2 border-l-blue-200' : ''}`}
                    style={{ width: CELL_WIDTH }}
                    title={tooltip}
                  >
                    <span className={`text-xs ${isRed ? 'text-red-600 font-medium' : 'text-gray-500'}`}>{d.getDate()}</span>
                    <span className={`text-[10px] ${isRed ? 'text-red-500' : 'text-gray-400'}`}>
                      {['일', '월', '화', '수', '목', '금', '토'][dow]}
                    </span>
                    {dayLeaves.length > 0 && (
                      <span className="text-[9px] text-amber-600 font-medium mt-0.5">휴</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="overflow-x-auto" style={{ minHeight: 200 }}>
              {(ganttProjectFilter ? activeProjects.filter((p: any) => p.id === ganttProjectFilter) : activeProjects)
                .filter((project: any) => {
                  const tasks = (project.tasks || []).filter(
                    (t: any) => (!ganttAssigneeFilter || hasAssignee(t, ganttAssigneeFilter)) && taskVisibleInGantt(t)
                  );
                  return tasks.length > 0;
                })
                .map((project: any) => {
                const filteredTasks = (project.tasks || []).filter(
                  (t: any) => (!ganttAssigneeFilter || hasAssignee(t, ganttAssigneeFilter)) && taskVisibleInGantt(t)
                );
                return (
                <div key={project.id} className="border-b border-gray-100">
                  {/* 태스크별 Gantt 바 행만 (프로젝트 행 없음) */}
                  {filteredTasks.map((task: any) => {
                    const barStyle = getBarStyle(task);
                    return (
                      <div
                        key={task.id}
                        className="relative flex items-center border-b border-gray-50"
                        style={{ height: 56 }}
                      >
                        {barStyle ? (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 h-8 rounded-full overflow-hidden flex items-center"
                            style={{
                              left: barStyle.leftPx + 12,
                              width: barStyle.widthPx,
                              backgroundColor: barStyle.color,
                            }}
                          >
                            <span className="absolute inset-0 flex items-center justify-center text-white font-semibold text-sm drop-shadow-sm">
                              {t(STATUS_LABELS[barStyle.status as string] ?? 'statusTodo')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 ml-4">{t('noSchedule')}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
      )}

      {/* 완료 스케줄 탭 */}
      {activeTab === 'completed' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-gray-500">{year}{t('year')}</span>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {[year - 2, year - 1, year, year + 1, year + 2].map((y) => (
                  <option key={y} value={y}>{y}{t('year')}</option>
                ))}
              </select>
              <select
                value={completedProjectFilter ?? ''}
                onChange={(e) => setCompletedProjectFilter(e.target.value || null)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[140px]"
              >
                <option value="">{t('allProjects')}</option>
                {completedProjects.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select
                value={completedAssigneeFilter}
                onChange={(e) => setCompletedAssigneeFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[140px]"
              >
                <option value="">{t('assignee')}</option>
                {assignableUsers.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {completedProjects
              .filter((p: any) => !completedProjectFilter || p.id === completedProjectFilter)
              .filter((p: any) => !completedAssigneeFilter || (p.tasks || []).some((t: any) => hasAssignee(t, completedAssigneeFilter)))
              .length === 0 ? (
              <div className="py-16 text-center text-gray-500">
                <p className="mb-4">
                  {completedProjects.length === 0 ? t('noProjects') : '필터 조건에 맞는 완료 프로젝트가 없습니다.'}
                </p>
              </div>
            ) : (
              completedProjects
                .filter((p: any) => !completedProjectFilter || p.id === completedProjectFilter)
                .filter((p: any) => !completedAssigneeFilter || (p.tasks || []).some((t: any) => hasAssignee(t, completedAssigneeFilter)))
                .map((project: any, pi: number) => (
                  <div key={project.id} className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                        style={{ backgroundColor: project.color || PROJECT_COLORS[pi % PROJECT_COLORS.length] }}
                      >
                        ✓
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{project.name}</p>
                        {project.description && <p className="text-xs text-gray-500">{project.description}</p>}
                      </div>
                      <span className="ml-auto text-sm font-medium text-green-600">100%</span>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleOpenProjectForm(project)} className="text-sm text-gray-500 hover:underline">{t('edit')}</button>
                        <button onClick={() => window.confirm(t('deleteConfirm')) && deleteProjectMutation.mutate(project.id)} className="text-sm text-red-500 hover:underline">{t('delete')}</button>
                      </div>
                    </div>
                    <div className="ml-12 space-y-2 border-l-2 border-green-200 pl-4">
                      {(project.tasks || []).map((task: any) => (
                        <div key={task.id} className="flex items-center justify-between py-2">
                          <div>
                            <p className="font-medium text-gray-800">{task.title}</p>
                            <div className="flex gap-2 text-xs text-gray-500 mt-0.5">
                              {task.startDate && task.endDate && <span>{task.startDate} ~ {task.endDate}</span>}
                              {((task.assigneeNames?.length ? task.assigneeNames : task.assigneeName ? [task.assigneeName] : []) as string[]).length > 0 && (
                                <span>@{(task.assigneeNames?.length ? task.assigneeNames : [task.assigneeName]).join(', ')}</span>
                              )}
                              <span className="text-green-600">{t('statusDone')}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleOpenTaskForm(project.id, task)} className="text-xs text-blue-600 hover:underline">{t('edit')}</button>
                            <button onClick={() => window.confirm(t('deleteConfirm')) && deleteTaskMutation.mutate(task.id)} className="text-xs text-red-500 hover:underline">{t('delete')}</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* To-do 탭 */}
      {activeTab === 'todo' && (
        <div className="max-w-3xl">
          <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-indigo-50/30 to-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-indigo-100/80 bg-indigo-50/40">
              <h3 className="text-lg font-semibold text-slate-800">{t('scheduleTabTodo')}</h3>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">{t('scheduleTodoIntro')}</p>
              <p className="text-xs font-medium text-indigo-700 mt-2">
                {t('todoRemaining').replace('{0}', String(todoActiveCount))}
              </p>
            </div>
            <div className="p-4 sm:p-5 space-y-5">
              <form
                className="flex flex-col sm:flex-row gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = newTodoText.trim();
                  if (!v || createPersonalTodoMutation.isPending) return;
                  createPersonalTodoMutation.mutate(v);
                }}
              >
                <input
                  type="text"
                  value={newTodoText}
                  onChange={(e) => setNewTodoText(e.target.value)}
                  placeholder={t('todoInputPlaceholder')}
                  className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                  maxLength={500}
                />
                <button
                  type="submit"
                  disabled={!newTodoText.trim() || createPersonalTodoMutation.isPending}
                  className="shrink-0 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-45 disabled:pointer-events-none transition-colors"
                >
                  {createPersonalTodoMutation.isPending ? t('processing') : t('todoAddBtn')}
                </button>
              </form>

              {personalTodos.length === 0 && !createPersonalTodoMutation.isPending && (
                <p className="text-center text-sm text-slate-500 py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  {t('todoEmpty')}
                </p>
              )}

              {todoActiveItems.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{t('todoSectionActive')}</p>
                  <ul className="space-y-1.5">
                    {todoActiveItems.map((item) => (
                      <li
                        key={item.id}
                        className="group flex items-start gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-sm hover:border-indigo-100 transition-colors"
                      >
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={false}
                          onClick={() => updatePersonalTodoMutation.mutate({ id: item.id, data: { done: true } })}
                          className="mt-0.5 h-5 w-5 shrink-0 rounded-md border-2 border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 transition-colors"
                          title={t('statusDone')}
                        />
                        {editingTodoId === item.id ? (
                          <input
                            autoFocus
                            value={editingTodoText}
                            onChange={(e) => setEditingTodoText(e.target.value)}
                            onBlur={() => {
                              const v = editingTodoText.trim();
                              if (v && v !== item.title) {
                                updatePersonalTodoMutation.mutate({ id: item.id, data: { title: v } });
                              } else {
                                setEditingTodoId(null);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              if (e.key === 'Escape') {
                                setEditingTodoId(null);
                                setEditingTodoText('');
                              }
                            }}
                            className="flex-1 min-w-0 rounded-lg border border-indigo-200 px-2 py-1 text-sm"
                            maxLength={500}
                          />
                        ) : (
                          <button
                            type="button"
                            className="flex-1 min-w-0 text-left text-sm text-slate-800 leading-snug"
                            onClick={() => {
                              setEditingTodoId(item.id);
                              setEditingTodoText(item.title);
                            }}
                          >
                            {item.title}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => window.confirm(t('deleteConfirm')) && deletePersonalTodoMutation.mutate(item.id)}
                          className="opacity-0 group-hover:opacity-100 text-xs text-red-600 hover:underline shrink-0 pt-0.5"
                        >
                          {t('delete')}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {todoDoneItems.length > 0 && (
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('todoSectionDone')}</p>
                    <button
                      type="button"
                      onClick={() =>
                        window.confirm(t('deleteConfirm')) && clearDonePersonalTodosMutation.mutate()
                      }
                      disabled={clearDonePersonalTodosMutation.isPending}
                      className="text-xs text-slate-500 hover:text-red-600 underline-offset-2 hover:underline disabled:opacity-50"
                    >
                      {t('todoClearDone')}
                    </button>
                  </div>
                  <ul className="space-y-1.5 opacity-90">
                    {todoDoneItems.map((item) => (
                      <li
                        key={item.id}
                        className="group flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
                      >
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked
                          onClick={() => updatePersonalTodoMutation.mutate({ id: item.id, data: { done: false } })}
                          className="mt-0.5 h-5 w-5 shrink-0 rounded-md border-2 border-indigo-500 bg-indigo-500 flex items-center justify-center"
                          title={t('statusTodo')}
                        >
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <span className="flex-1 text-sm text-slate-500 line-through leading-snug">{item.title}</span>
                        <button
                          type="button"
                          onClick={() => window.confirm(t('deleteConfirm')) && deletePersonalTodoMutation.mutate(item.id)}
                          className="opacity-0 group-hover:opacity-100 text-xs text-red-600 hover:underline shrink-0 pt-0.5"
                        >
                          {t('delete')}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 프로젝트 추가/수정 모달 */}
      {showProjectForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              {editProject ? t('edit') : t('addProject')}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('projectName')}</label>
                <input
                  value={projectForm.name}
                  onChange={(e) => setProjectForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder={t('projectName')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('projectDescription')}</label>
                <textarea
                  value={projectForm.description}
                  onChange={(e) => setProjectForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder={t('projectDescription')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('projectColor')}</label>
                <div className="flex gap-2">
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setProjectForm((f) => ({ ...f, color: c }))}
                      className={`w-8 h-8 rounded-full border-2 ${projectForm.color === c ? 'border-gray-800' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => { setShowProjectForm(false); setEditProject(null); }}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium"
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => {
                  if (editProject) {
                    updateProjectMutation.mutate({ id: editProject.id, data: projectForm });
                  } else {
                    createProjectMutation.mutate(projectForm);
                  }
                }}
                disabled={!projectForm.name || createProjectMutation.isPending || updateProjectMutation.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {(createProjectMutation.isPending || updateProjectMutation.isPending) ? t('processing') : (editProject ? t('edit') : t('add'))}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 태스크 추가/수정 모달 */}
      {showTaskForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              {editTask ? t('edit') : t('addTask')}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('project')}</label>
                <select
                  value={taskForm.projectId}
                  onChange={(e) => setTaskForm((f) => ({ ...f, projectId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  disabled={!!editTask}
                >
                  <option value="">—</option>
                  {activeProjects.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('taskTitle')}</label>
                <input
                  value={taskForm.title}
                  onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder={t('taskTitle')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('taskDescription')}</label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder={t('taskDescription')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('startDate')} ~ {t('endDate')}</label>
                <DatePicker
                  selectsRange
                  startDate={taskForm.startDate ? new Date(taskForm.startDate) : null}
                  endDate={taskForm.endDate ? new Date(taskForm.endDate) : null}
                  onChange={([s, e]: [Date | null, Date | null]) => {
                    setTaskForm((f) => ({
                      ...f,
                      startDate: formatDateForApi(s),
                      endDate: e ? formatDateForApi(e) : '',
                    }));
                  }}
                  locale={dateLocale}
                  dateFormat="yyyy-MM-dd"
                  formatWeekDay={(name) => name.charAt(0)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholderText={t('dateRangePlaceholder')}
                  highlightDates={taskFormHighlightDates}
                  popperClassName="react-datepicker-popper-z"
                  popperContainer={({ children }: { children?: React.ReactNode }) => createPortal(children ?? null, document.body)}
                />
                <p className="text-xs text-gray-500 mt-1">{t('dateRangeHint')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('status')}</label>
                <select
                  value={taskForm.status}
                  onChange={(e) => setTaskForm((f) => ({ ...f, status: e.target.value as 'TODO' | 'IN_PROGRESS' | 'DONE' }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="TODO">{t('statusTodo')}</option>
                  <option value="IN_PROGRESS">{t('statusInProgress')}</option>
                  <option value="DONE">{t('statusDone')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('assignee')} (다중 선택)</label>
                <select
                  multiple
                  value={taskForm.assigneeIds}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, (o) => o.value);
                    setTaskForm((f) => ({ ...f, assigneeIds: selected }));
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[80px]"
                >
                  {assignableUsers.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Ctrl/Cmd + 클릭으로 여러 명 선택</p>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => { setShowTaskForm(false); setEditTask(null); }}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium"
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => {
                  const statusToProgress = { TODO: 0, IN_PROGRESS: 50, DONE: 100 };
                  const payload = {
                    title: taskForm.title,
                    description: taskForm.description || undefined,
                    projectId: taskForm.projectId || null,
                    startDate: taskForm.startDate || null,
                    endDate: taskForm.endDate || null,
                    status: taskForm.status,
                    progress: statusToProgress[taskForm.status],
                    priority: taskForm.priority,
                    assigneeIds: taskForm.assigneeIds.length > 0 ? taskForm.assigneeIds : null,
                  };
                  if (editTask) {
                    updateTaskMutation.mutate({ id: editTask.id, data: payload });
                  } else {
                    createTaskMutation.mutate(payload);
                  }
                }}
                disabled={!taskForm.title || (!taskForm.projectId && !editTask) || createTaskMutation.isPending || updateTaskMutation.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {(createTaskMutation.isPending || updateTaskMutation.isPending) ? t('processing') : (editTask ? t('edit') : t('add'))}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
