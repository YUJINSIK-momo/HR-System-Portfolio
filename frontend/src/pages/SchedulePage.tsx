import { useState, useMemo } from 'react';

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

interface Task {
  id: string;
  title: string;
  description?: string;
  projectId: string;
  startDate: string;
  endDate: string;
  status: TaskStatus;
  assigneeName?: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  color: string;
  tasks: Task[];
}

interface TodoItem {
  id: string;
  title: string;
  done: boolean;
}

const PROJECT_COLORS = ['#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#EC4899'];
const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];

const INITIAL_PROJECTS: Project[] = [
  {
    id: 'p1', name: 'HR 시스템 고도화', description: '2026 상반기 핵심 개발 과제', color: '#7C3AED',
    tasks: [
      { id: 't1', title: '근태 자동화 모듈 개발', description: '출퇴근 API 연동 및 자동화', projectId: 'p1', startDate: '2026-04-01', endDate: '2026-05-15', status: 'IN_PROGRESS', assigneeName: '김진식' },
      { id: 't2', title: 'Supabase DB 마이그레이션', description: '기존 DB 스키마 이전 및 검증', projectId: 'p1', startDate: '2026-03-01', endDate: '2026-04-10', status: 'DONE', assigneeName: '박준혁' },
      { id: 't3', title: '연차 관리 UI 개선', description: '사용자 경험 중심 리디자인', projectId: 'p1', startDate: '2026-05-16', endDate: '2026-06-30', status: 'TODO', assigneeName: '최지은' },
      { id: 't4', title: 'API 문서화 및 테스트', projectId: 'p1', startDate: '2026-06-01', endDate: '2026-07-15', status: 'TODO' },
    ],
  },
  {
    id: 'p2', name: '신규 온보딩 자동화', description: '입사자 온보딩 프로세스 디지털화', color: '#3B82F6',
    tasks: [
      { id: 't5', title: '온보딩 체크리스트 개발', description: '단계별 체크리스트 UI 구현', projectId: 'p2', startDate: '2026-04-15', endDate: '2026-05-20', status: 'IN_PROGRESS', assigneeName: '정민준' },
      { id: 't6', title: '이메일 자동발송 연동', projectId: 'p2', startDate: '2026-05-21', endDate: '2026-06-10', status: 'TODO', assigneeName: '윤채원' },
      { id: 't7', title: '입사 서류 전자화', projectId: 'p2', startDate: '2026-06-11', endDate: '2026-06-30', status: 'TODO' },
    ],
  },
  {
    id: 'p3', name: '직원 만족도 조사 시스템', description: '분기별 만족도 조사 자동화', color: '#10B981',
    tasks: [
      { id: 't8', title: '설문 폼 개발', projectId: 'p3', startDate: '2026-03-01', endDate: '2026-03-20', status: 'DONE', assigneeName: '황소연' },
      { id: 't9', title: '결과 대시보드 제작', projectId: 'p3', startDate: '2026-03-21', endDate: '2026-04-05', status: 'DONE', assigneeName: '이도현' },
      { id: 't10', title: '리포트 PDF 내보내기', projectId: 'p3', startDate: '2026-04-06', endDate: '2026-04-15', status: 'DONE', assigneeName: '강하늘' },
    ],
  },
];

const INITIAL_TODOS: TodoItem[] = [
  { id: 'td1', title: 'Q2 OKR 검토 미팅 자료 준비', done: false },
  { id: 'td2', title: '5월 팀 회식 장소 예약', done: false },
  { id: 'td3', title: '신규 정책 공지 초안 작성', done: false },
  { id: 'td4', title: '4월 근태 결산 리포트 확인', done: true },
];

const STATUS_LABEL: Record<TaskStatus, string> = { TODO: '대기', IN_PROGRESS: '진행중', DONE: '완료' };
const STATUS_CLS: Record<TaskStatus, string> = {
  TODO: 'bg-slate-100 text-slate-500',
  IN_PROGRESS: 'bg-violet-100 text-violet-700',
  DONE: 'bg-emerald-100 text-emerald-700',
};

function progressOf(tasks: Task[]) {
  if (!tasks.length) return 0;
  return Math.round((tasks.filter(t => t.status === 'DONE').length / tasks.length) * 100);
}

function uid() { return Math.random().toString(36).slice(2); }

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const last = new Date(year, month, 0).getDate();
  for (let d = 1; d <= last; d++) days.push(new Date(year, month - 1, d));
  return days;
}

function toYMD(d: Date) { return d.toISOString().slice(0, 10); }

export default function SchedulePage() {
  const today = new Date();
  const [activeTab, setActiveTab] = useState<'list' | 'gantt' | 'completed' | 'todo'>('list');
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [todos, setTodos] = useState<TodoItem[]>(INITIAL_TODOS);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set(['p1']));
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [projectForm, setProjectForm] = useState({ name: '', description: '', color: PROJECT_COLORS[0] });
  const [taskForm, setTaskForm] = useState({ title: '', description: '', projectId: '', startDate: '', endDate: '', status: 'TODO' as TaskStatus, assigneeName: '' });
  const [newTodoText, setNewTodoText] = useState('');

  const activeProjects = useMemo(() => projects.filter(p => progressOf(p.tasks) < 100 || p.tasks.length === 0), [projects]);
  const completedProjects = useMemo(() => projects.filter(p => p.tasks.length > 0 && progressOf(p.tasks) === 100), [projects]);
  const activeTodos = useMemo(() => todos.filter(t => !t.done), [todos]);
  const doneTodos = useMemo(() => todos.filter(t => t.done), [todos]);

  const DAY_MS = 86400000;
  const CELL_W = 38;
  const days = useMemo(() => getDaysInMonth(year, month), [year, month]);
  const viewStartMs = useMemo(() => new Date(year, month - 1, 1).getTime(), [year, month]);
  const viewEndMs = useMemo(() => new Date(year, month, 0).getTime(), [year, month]);

  const visibleGanttTasks = useMemo(() =>
    activeProjects.flatMap(project =>
      project.tasks
        .filter(task => {
          const s = task.startDate ? new Date(task.startDate).getTime() : null;
          const e = task.endDate ? new Date(task.endDate).getTime() : null;
          if (!s || !e) return false;
          return !(e < viewStartMs || s > viewEndMs);
        })
        .map(task => ({ task, project }))
    ), [activeProjects, viewStartMs, viewEndMs]);

  function getBarStyle(task: Task) {
    const s = task.startDate ? new Date(task.startDate).getTime() : null;
    const e = task.endDate ? new Date(task.endDate).getTime() : null;
    if (!s || !e || e < s) return null;
    if (e < viewStartMs || s > viewEndMs) return null;
    const leftDays = Math.max(0, (s - viewStartMs) / DAY_MS);
    const widthDays = (Math.min(e, viewEndMs) - Math.max(s, viewStartMs)) / DAY_MS + 1;
    if (widthDays <= 0) return null;
    const color = task.status === 'DONE' ? '#10B981' : task.status === 'IN_PROGRESS' ? '#7C3AED' : '#94A3B8';
    return { left: leftDays * CELL_W, width: Math.max(CELL_W, widthDays * CELL_W), color };
  }

  function openProjectModal(project?: Project) {
    setEditingProject(project || null);
    setProjectForm(project ? { name: project.name, description: project.description || '', color: project.color } : { name: '', description: '', color: PROJECT_COLORS[0] });
    setShowProjectModal(true);
  }

  function saveProject() {
    if (!projectForm.name.trim()) return;
    if (editingProject) {
      setProjects(ps => ps.map(p => p.id === editingProject.id ? { ...p, ...projectForm } : p));
    } else {
      setProjects(ps => [...ps, { id: uid(), ...projectForm, tasks: [] }]);
    }
    setShowProjectModal(false);
    setEditingProject(null);
  }

  function deleteProject(id: string) {
    if (!confirm('프로젝트를 삭제하시겠습니까?')) return;
    setProjects(ps => ps.filter(p => p.id !== id));
  }

  function openTaskModal(projectId?: string, task?: Task) {
    setEditingTask(task || null);
    setTaskForm(task
      ? { title: task.title, description: task.description || '', projectId: task.projectId, startDate: task.startDate, endDate: task.endDate, status: task.status, assigneeName: task.assigneeName || '' }
      : { title: '', description: '', projectId: projectId || activeProjects[0]?.id || '', startDate: '', endDate: '', status: 'TODO', assigneeName: '' });
    setShowTaskModal(true);
  }

  function saveTask() {
    if (!taskForm.title.trim() || !taskForm.projectId) return;
    const task: Task = { id: editingTask?.id || uid(), ...taskForm };
    if (editingTask) {
      setProjects(ps => ps.map(p => p.id === task.projectId ? { ...p, tasks: p.tasks.map(t => t.id === task.id ? task : t) } : p));
    } else {
      setProjects(ps => ps.map(p => p.id === task.projectId ? { ...p, tasks: [...p.tasks, task] } : p));
    }
    setShowTaskModal(false);
    setEditingTask(null);
  }

  function deleteTask(projectId: string, taskId: string) {
    if (!confirm('태스크를 삭제하시겠습니까?')) return;
    setProjects(ps => ps.map(p => p.id === projectId ? { ...p, tasks: p.tasks.filter(t => t.id !== taskId) } : p));
  }

  function toggleExpand(id: string) {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }

  return (
    <div className="min-h-full bg-notion-surface p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-notion-charcoal tracking-tight">스케줄 관리</h2>
          <p className="mt-0.5 text-sm text-notion-steel">프로젝트 및 개인 일정을 관리합니다</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => openProjectModal()} className="px-4 py-2.5 border border-notion-hairline bg-notion-canvas text-slate-700 text-sm font-semibold rounded-notion-btn hover:bg-slate-50 shadow-notion-subtle transition-colors">
            프로젝트 추가
          </button>
          <button onClick={() => openTaskModal()} disabled={activeProjects.length === 0} className="px-4 py-2.5 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold rounded-notion-btn shadow-md shadow-violet-200 disabled:opacity-50 transition-colors">
            태스크 추가
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-6">
        {(['list', 'gantt', 'completed', 'todo'] as const).map(tab => {
          const labels = { list: '목록', gantt: '간트 차트', completed: '완료', todo: '할 일' };
          return (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === tab ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {labels[tab]}
              {tab === 'completed' && completedProjects.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs">{completedProjects.length}</span>
              )}
              {tab === 'todo' && activeTodos.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs tabular-nums">{activeTodos.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── LIST TAB ── */}
      {activeTab === 'list' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-slate-500">연도</span>
            <select value={year} onChange={e => setYear(+e.target.value)}
              className="rounded-notion-btn border border-notion-hairline bg-notion-canvas px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-600"
            >
              {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
          </div>

          {activeProjects.length === 0 ? (
            <div className="rounded-notion-card bg-notion-canvas border border-notion-hairline p-16 text-center">
              <div className="w-12 h-12 rounded-full bg-notion-tint-lavender flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-sm text-slate-500 mb-3">진행 중인 프로젝트가 없습니다</p>
              <button onClick={() => openProjectModal()} className="text-sm font-semibold text-violet-700 hover:underline">+ 프로젝트 추가</button>
            </div>
          ) : (
            activeProjects.map(project => {
              const pct = progressOf(project.tasks);
              const isExpanded = expandedProjects.has(project.id);
              const inProgress = project.tasks.filter(t => t.status === 'IN_PROGRESS').length;
              const todo = project.tasks.filter(t => t.status === 'TODO').length;
              const done = project.tasks.filter(t => t.status === 'DONE').length;
              return (
                <div key={project.id} className="rounded-notion-card bg-notion-canvas border border-notion-hairline shadow-notion-subtle overflow-hidden">
                  {/* Project header row */}
                  <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50/60 transition-colors" onClick={() => toggleExpand(project.id)}>
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800">{project.name}</span>
                        {project.description && <span className="text-xs text-slate-400">{project.description}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: project.color }} />
                        </div>
                        <span className="text-xs tabular-nums text-slate-400">{pct}%</span>
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                      {inProgress > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium">진행 {inProgress}</span>}
                      {todo > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">대기 {todo}</span>}
                      {done > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">완료 {done}</span>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openTaskModal(project.id)} className="text-xs text-violet-700 hover:text-violet-900 font-semibold transition-colors">+ 태스크</button>
                      <button onClick={() => openProjectModal(project)} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">수정</button>
                      <button onClick={() => deleteProject(project.id)} className="text-xs text-rose-400 hover:text-rose-600 transition-colors">삭제</button>
                      <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Task rows */}
                  {isExpanded && (
                    <div className="border-t border-notion-hairline">
                      {project.tasks.length === 0 ? (
                        <p className="px-5 py-4 text-sm text-slate-400 text-center">태스크가 없습니다</p>
                      ) : (
                        <div className="divide-y divide-slate-50">
                          {project.tasks.map(task => (
                            <div key={task.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors">
                              <div className={`w-2 h-2 rounded-full shrink-0 ${task.status === 'DONE' ? 'bg-emerald-400' : task.status === 'IN_PROGRESS' ? 'bg-violet-500' : 'bg-slate-300'}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-sm font-medium ${task.status === 'DONE' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{task.title}</span>
                                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_CLS[task.status]}`}>{STATUS_LABEL[task.status]}</span>
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                                  {task.startDate && task.endDate && <span>{task.startDate} ~ {task.endDate}</span>}
                                  {task.assigneeName && (
                                    <span className="flex items-center gap-1">
                                      <span className="w-4 h-4 rounded-full bg-violet-100 text-violet-600 text-[9px] font-bold inline-flex items-center justify-center">{task.assigneeName[0]}</span>
                                      {task.assigneeName}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                <button onClick={() => openTaskModal(project.id, task)} className="text-xs text-violet-600 hover:text-violet-800 transition-colors">수정</button>
                                <button onClick={() => deleteTask(project.id, task.id)} className="text-xs text-rose-400 hover:text-rose-600 transition-colors">삭제</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── GANTT TAB ── */}
      {activeTab === 'gantt' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={prevMonth} className="p-2 rounded-notion-btn border border-notion-hairline bg-notion-canvas hover:bg-slate-50 text-slate-600 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="min-w-[100px] text-center text-sm font-semibold text-slate-800">{year}년 {month}월</span>
            <button onClick={nextMonth} className="p-2 rounded-notion-btn border border-notion-hairline bg-notion-canvas hover:bg-slate-50 text-slate-600 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
            <div className="ml-3 flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-xs text-slate-400"><span className="w-3 h-3 rounded-sm bg-violet-500 inline-block" />진행중</span>
              <span className="flex items-center gap-1.5 text-xs text-slate-400"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />완료</span>
              <span className="flex items-center gap-1.5 text-xs text-slate-400"><span className="w-3 h-3 rounded-sm bg-slate-300 inline-block" />대기</span>
            </div>
          </div>

          <div className="rounded-notion-card bg-notion-canvas border border-notion-hairline shadow-notion-subtle overflow-hidden">
            {visibleGanttTasks.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-400">이 달에 해당하는 태스크가 없습니다</div>
            ) : (
              <div className="flex overflow-x-auto">
                {/* Sidebar */}
                <div className="w-60 shrink-0 border-r border-notion-hairline bg-slate-50/50">
                  <div className="h-12 border-b border-notion-hairline flex items-center px-4">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">태스크</span>
                  </div>
                  {visibleGanttTasks.map(({ task, project }) => (
                    <div key={task.id} className="flex items-center gap-2.5 px-4 border-b border-slate-50 last:border-b-0 hover:bg-white/80 transition-colors" style={{ height: 52 }}>
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{task.title}</p>
                        <p className="text-xs text-slate-400 truncate">{project.name}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Timeline */}
                <div className="flex-1 overflow-x-auto" style={{ minWidth: 0 }}>
                  {/* Day headers */}
                  <div className="flex border-b border-notion-hairline" style={{ height: 48, minWidth: days.length * CELL_W }}>
                    {days.map((d, idx) => {
                      const dow = d.getDay();
                      const isWeekend = dow === 0 || dow === 6;
                      const isToday = toYMD(d) === toYMD(today);
                      return (
                        <div key={idx} className={`shrink-0 flex flex-col items-center justify-center border-r border-slate-100 ${isWeekend ? 'bg-rose-50/60' : ''} ${isToday ? 'bg-violet-50' : ''}`} style={{ width: CELL_W }}>
                          <span className={`text-[11px] font-semibold ${isToday ? 'text-violet-600' : isWeekend ? 'text-rose-400' : 'text-slate-500'}`}>{d.getDate()}</span>
                          <span className={`text-[9px] ${isToday ? 'text-violet-400' : isWeekend ? 'text-rose-300' : 'text-slate-300'}`}>{DOW_KO[dow]}</span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Gantt rows */}
                  <div style={{ minWidth: days.length * CELL_W }}>
                    {visibleGanttTasks.map(({ task }) => {
                      const bar = getBarStyle(task);
                      return (
                        <div key={task.id} className="relative border-b border-slate-50 last:border-b-0" style={{ height: 52 }}>
                          {/* Weekend shading */}
                          {days.map((d, idx) => {
                            const dow = d.getDay();
                            if (dow !== 0 && dow !== 6) return null;
                            return <div key={idx} className="absolute top-0 bottom-0 bg-rose-50/40" style={{ left: idx * CELL_W, width: CELL_W }} />;
                          })}
                          {bar && (
                            <div
                              className="absolute top-1/2 -translate-y-1/2 h-7 rounded-full flex items-center px-3 shadow-sm z-10 overflow-hidden"
                              style={{ left: bar.left + 4, width: Math.max(bar.width - 8, 36), backgroundColor: bar.color }}
                            >
                              <span className="text-white text-[11px] font-semibold truncate">{STATUS_LABEL[task.status]}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── COMPLETED TAB ── */}
      {activeTab === 'completed' && (
        <div className="space-y-3">
          {completedProjects.length === 0 ? (
            <div className="rounded-notion-card bg-notion-canvas border border-notion-hairline p-16 text-center">
              <div className="w-12 h-12 rounded-full bg-notion-tint-mint flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm text-slate-500">완료된 프로젝트가 없습니다</p>
            </div>
          ) : (
            completedProjects.map(project => (
              <div key={project.id} className="rounded-notion-card bg-notion-canvas border border-notion-hairline shadow-notion-subtle overflow-hidden">
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{project.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">100%</span>
                    </div>
                    {project.description && <p className="text-xs text-slate-400 mt-0.5">{project.description}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => openProjectModal(project)} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">수정</button>
                    <button onClick={() => deleteProject(project.id)} className="text-xs text-rose-400 hover:text-rose-600 transition-colors">삭제</button>
                  </div>
                </div>
                <div className="border-t border-notion-hairline divide-y divide-slate-50">
                  {project.tasks.map(task => (
                    <div key={task.id} className="flex items-center gap-3 px-5 py-3">
                      <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-slate-400 line-through flex-1">{task.title}</span>
                      {task.startDate && task.endDate && <span className="text-xs text-slate-300 shrink-0">{task.startDate} ~ {task.endDate}</span>}
                      {task.assigneeName && (
                        <span className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                          <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-500 text-[9px] font-bold inline-flex items-center justify-center">{task.assigneeName[0]}</span>
                          {task.assigneeName}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── TODO TAB ── */}
      {activeTab === 'todo' && (
        <div className="max-w-2xl">
          <div className="rounded-notion-card bg-notion-canvas border border-notion-hairline shadow-notion-subtle overflow-hidden">
            <div className="px-5 py-4 border-b border-notion-hairline bg-notion-tint-lavender/60">
              <h3 className="text-base font-semibold text-slate-800">개인 할 일</h3>
              <p className="text-sm text-slate-500 mt-0.5">
                {activeTodos.length > 0 ? `${activeTodos.length}개 남음` : '모두 완료했습니다!'}
              </p>
            </div>
            <div className="p-5 space-y-5">
              <form className="flex gap-2" onSubmit={e => { e.preventDefault(); const v = newTodoText.trim(); if (!v) return; setTodos(ts => [...ts, { id: uid(), title: v, done: false }]); setNewTodoText(''); }}>
                <input
                  type="text" value={newTodoText} onChange={e => setNewTodoText(e.target.value)}
                  placeholder="새 할 일 입력..."
                  className="flex-1 min-w-0 rounded-notion-btn border border-notion-hairline-strong bg-slate-50 px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent transition"
                  maxLength={200}
                />
                <button type="submit" disabled={!newTodoText.trim()} className="shrink-0 rounded-notion-btn bg-violet-700 hover:bg-violet-800 disabled:opacity-40 px-5 py-2.5 text-sm font-semibold text-white transition-colors">
                  추가
                </button>
              </form>

              {activeTodos.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">진행중</p>
                  <ul className="space-y-1.5">
                    {activeTodos.map(item => (
                      <li key={item.id} className="group flex items-center gap-3 rounded-notion-btn border border-notion-hairline bg-white px-3 py-2.5 hover:border-violet-200 transition-colors shadow-notion-subtle">
                        <button type="button" onClick={() => setTodos(ts => ts.map(t => t.id === item.id ? { ...t, done: true } : t))}
                          className="w-5 h-5 shrink-0 rounded-md border-2 border-slate-300 hover:border-violet-500 hover:bg-violet-50 transition-colors"
                        />
                        <span className="flex-1 text-sm text-slate-800">{item.title}</span>
                        <button type="button" onClick={() => setTodos(ts => ts.filter(t => t.id !== item.id))}
                          className="opacity-0 group-hover:opacity-100 text-xs text-rose-400 hover:text-rose-600 transition-colors"
                        >삭제</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {doneTodos.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">완료</p>
                    <button type="button" onClick={() => setTodos(ts => ts.filter(t => !t.done))} className="text-xs text-slate-400 hover:text-rose-500 transition-colors">완료 항목 지우기</button>
                  </div>
                  <ul className="space-y-1.5 opacity-70">
                    {doneTodos.map(item => (
                      <li key={item.id} className="group flex items-center gap-3 rounded-notion-btn border border-slate-100 bg-slate-50 px-3 py-2.5">
                        <button type="button" onClick={() => setTodos(ts => ts.map(t => t.id === item.id ? { ...t, done: false } : t))}
                          className="w-5 h-5 shrink-0 rounded-md border-2 border-violet-500 bg-violet-500 flex items-center justify-center"
                        >
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        </button>
                        <span className="flex-1 text-sm text-slate-400 line-through">{item.title}</span>
                        <button type="button" onClick={() => setTodos(ts => ts.filter(t => t.id !== item.id))}
                          className="opacity-0 group-hover:opacity-100 text-xs text-rose-400 hover:text-rose-600 transition-colors"
                        >삭제</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {activeTodos.length === 0 && doneTodos.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-8 border border-dashed border-slate-200 rounded-notion-btn bg-slate-50/50">
                  할 일이 없습니다. 위에서 추가해보세요!
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── PROJECT MODAL ── */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-notion-navy/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-notion-canvas rounded-notion-card w-full max-w-md shadow-notion-modal p-6 border border-notion-hairline">
            <h3 className="text-base font-semibold text-slate-800 mb-5">{editingProject ? '프로젝트 수정' : '프로젝트 추가'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">프로젝트명</label>
                <input value={projectForm.name} onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-notion-btn border border-notion-hairline-strong bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-600"
                  placeholder="프로젝트명 입력" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">설명 (선택)</label>
                <input value={projectForm.description} onChange={e => setProjectForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-notion-btn border border-notion-hairline-strong bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-600"
                  placeholder="간단한 설명" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">색상</label>
                <div className="flex gap-2">
                  {PROJECT_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setProjectForm(f => ({ ...f, color: c }))}
                      className={`w-8 h-8 rounded-full border-4 transition-transform hover:scale-110 ${projectForm.color === c ? 'border-slate-700 scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => { setShowProjectModal(false); setEditingProject(null); }}
                className="flex-1 rounded-notion-btn border border-notion-hairline px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">취소</button>
              <button onClick={saveProject} disabled={!projectForm.name.trim()}
                className="flex-1 rounded-notion-btn bg-violet-700 hover:bg-violet-800 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-200 disabled:opacity-50 transition-colors">
                {editingProject ? '저장' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TASK MODAL ── */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-notion-navy/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-notion-canvas rounded-notion-card w-full max-w-md shadow-notion-modal p-6 border border-notion-hairline max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-slate-800 mb-5">{editingTask ? '태스크 수정' : '태스크 추가'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">프로젝트</label>
                <select value={taskForm.projectId} onChange={e => setTaskForm(f => ({ ...f, projectId: e.target.value }))} disabled={!!editingTask}
                  className="w-full rounded-notion-btn border border-notion-hairline-strong bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-600 disabled:opacity-50">
                  <option value="">선택</option>
                  {activeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">태스크명</label>
                <input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-notion-btn border border-notion-hairline-strong bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-600"
                  placeholder="태스크명 입력" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">설명 (선택)</label>
                <input value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-notion-btn border border-notion-hairline-strong bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-600"
                  placeholder="간단한 설명" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">시작일</label>
                  <input type="date" value={taskForm.startDate} onChange={e => setTaskForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full rounded-notion-btn border border-notion-hairline-strong bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-600" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">종료일</label>
                  <input type="date" value={taskForm.endDate} onChange={e => setTaskForm(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full rounded-notion-btn border border-notion-hairline-strong bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-600" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">상태</label>
                <div className="flex gap-2">
                  {(['TODO', 'IN_PROGRESS', 'DONE'] as TaskStatus[]).map(s => (
                    <button key={s} type="button" onClick={() => setTaskForm(f => ({ ...f, status: s }))}
                      className={`flex-1 py-2 text-xs font-semibold rounded-notion-btn border transition-colors ${
                        taskForm.status === s
                          ? s === 'DONE' ? 'border-emerald-400 bg-emerald-100 text-emerald-700' : s === 'IN_PROGRESS' ? 'border-violet-400 bg-violet-100 text-violet-700' : 'border-slate-400 bg-slate-100 text-slate-700'
                          : 'border-notion-hairline text-slate-400 hover:border-slate-300'
                      }`}
                    >{STATUS_LABEL[s]}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">담당자 (선택)</label>
                <input value={taskForm.assigneeName} onChange={e => setTaskForm(f => ({ ...f, assigneeName: e.target.value }))}
                  className="w-full rounded-notion-btn border border-notion-hairline-strong bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-600"
                  placeholder="담당자 이름" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => { setShowTaskModal(false); setEditingTask(null); }}
                className="flex-1 rounded-notion-btn border border-notion-hairline px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">취소</button>
              <button onClick={saveTask} disabled={!taskForm.title.trim() || !taskForm.projectId}
                className="flex-1 rounded-notion-btn bg-violet-700 hover:bg-violet-800 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-200 disabled:opacity-50 transition-colors">
                {editingTask ? '저장' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
