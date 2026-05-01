import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

type NavItem = { to: string; icon: React.ReactNode; label: string; end?: boolean };
type NavSection = { key: string; icon: React.ReactNode; label: string; items: NavItem[] };

function IconDashboard() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
}
function IconClock() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}
function IconCalendar() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
}
function IconLeave() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;
}
function IconGemini() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>;
}
function IconBell() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;
}
function IconMegaphone() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>;
}
function IconSchedule() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>;
}
function IconUsers() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
}
function IconChartBar() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
}
function IconClipboard() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>;
}
function IconLogout() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>;
}
function IconMenu() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>;
}
function IconChevron({ open }: { open: boolean }) {
  return (
    <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

const NAV_SECTIONS: NavSection[] = [
  {
    key: 'hr', icon: null, label: 'HR',
    items: [
      { to: '/', icon: <IconDashboard />, label: '대시보드', end: true },
      { to: '/attendance', icon: <IconClock />, label: '근태 관리' },
      { to: '/leave', icon: <IconLeave />, label: '연차 관리' },
      { to: '/calendar', icon: <IconCalendar />, label: '사내 캘린더' },
    ],
  },
  {
    key: 'ai', icon: null, label: 'AI',
    items: [
      { to: '/gemini', icon: <IconGemini />, label: 'GEMINI' },
    ],
  },
  {
    key: 'communication', icon: null, label: 'Communication',
    items: [
      { to: '/announcements', icon: <IconMegaphone />, label: '공지사항' },
      { to: '/schedule', icon: <IconSchedule />, label: '스케줄 관리' },
      { to: '/notifications', icon: <IconBell />, label: '알림' },
    ],
  },
  {
    key: 'admin', icon: null, label: 'Admin',
    items: [
      { to: '/admin/users', icon: <IconUsers />, label: '직원 관리' },
      { to: '/admin/attendance', icon: <IconChartBar />, label: '근태 현황' },
      { to: '/admin/leave', icon: <IconClipboard />, label: '휴가 신청 관리' },
    ],
  },
];

const PAGE_TITLES: Record<string, string> = {
  '/': '대시보드',
  '/attendance': '근태 관리',
  '/leave': '연차 관리',
  '/calendar': '사내 캘린더',
  '/gemini': 'GEMINI AI',
  '/announcements': '공지사항',
  '/schedule': '스케줄 관리',
  '/notifications': '알림',
  '/admin/users': '직원 관리',
  '/admin/attendance': '근태 현황',
  '/admin/leave': '휴가 신청 관리',
};

function getPageTitle(pathname: string): string {
  if (pathname === '/') return PAGE_TITLES['/'];
  for (const [path, title] of Object.entries(PAGE_TITLES)) {
    if (path !== '/' && pathname.startsWith(path)) return title;
  }
  return 'HR System';
}

function SidebarSection({ section }: { section: NavSection }) {
  const location = useLocation();
  const isActive = section.items.some((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
  );
  const [open, setOpen] = useState(isActive || section.key === 'hr');

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-1.5 mb-0.5 rounded-lg hover:bg-slate-50 transition-colors group"
      >
        <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${
          isActive ? 'text-indigo-500' : 'text-slate-400 group-hover:text-slate-500'
        }`}>
          {section.label}
        </span>
        <IconChevron open={open} />
      </button>

      {open && (
        <div className="mb-2 space-y-0.5">
          {section.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-200'
                    : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={isActive ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function Sidebar({ onClose }: { onClose?: () => void }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('demo-auth');
    logout();
    navigate('/login');
  };

  return (
    <aside className="flex h-full flex-col bg-white border-r border-slate-200">
      {/* Brand */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-700 px-5 py-5">
        <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/10" />
        <div className="absolute right-2 bottom-1 h-12 w-12 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 shadow-sm">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-white">HR System</p>
            <p className="text-[10px] text-indigo-200 font-medium">Portfolio Demo</p>
          </div>
        </div>
      </div>

      {/* User profile */}
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-sm font-bold text-white shadow-sm">
            {user?.name?.charAt(0) ?? 'A'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800 truncate">{user?.name ?? '관리자'}</p>
            <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
          </div>
          <span className="shrink-0 rounded-md bg-indigo-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            Admin
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1" onClick={onClose}>
        {NAV_SECTIONS.map((section) => (
          <SidebarSection key={section.key} section={section} />
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-3 border-t border-slate-100">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
        >
          <IconLogout />
          로그아웃
        </button>
      </div>
    </aside>
  );
}

export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pageTitle = getPageTitle(location.pathname);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-60 lg:flex-col lg:shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-72 lg:hidden">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </>
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-100 bg-white px-4 lg:px-6 shadow-sm shadow-slate-100">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
            >
              <IconMenu />
            </button>
            <div className="flex items-center gap-2">
              <div className="hidden sm:block h-4 w-0.5 bg-slate-200 rounded-full" />
              <h2 className="text-sm font-semibold text-slate-700">{pageTitle}</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs font-medium text-slate-400 bg-slate-50 rounded-lg px-3 py-1.5">
              {new Date('2026-04-28').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white shadow-sm shadow-indigo-200">
              관
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
