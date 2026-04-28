import type { InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import {
  MOCK_AUTH_ME,
  MOCK_ATTENDANCE_TODAY,
  MOCK_ATTENDANCE_CORRECTIONS_ME,
  MOCK_ATTENDANCE_CORRECTIONS_ADMIN,
  MOCK_ANNOUNCEMENTS,
  MOCK_CALENDAR_EVENTS,
  MOCK_HOLIDAYS,
  MOCK_LEAVE_BALANCE,
  MOCK_MY_LEAVE_REQUESTS,
  MOCK_LEAVE_NOTIFICATIONS,
  MOCK_LEAVE_REQUESTS_ADMIN,
  MOCK_SCHEDULE_PROJECTS,
  MOCK_PERSONAL_TODOS,
  MOCK_ASSIGNABLE_USERS,
  MOCK_APPROVED_FOR_SCHEDULE,
  MOCK_MEMO_REMINDERS,
  MOCK_EMPLOYEES,
  generateAdminAttendance,
  generateMyAttendanceHistory,
  generateCalendarLeaves,
} from './mockData';

function ok(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return { data, status: 200, statusText: 'OK', headers: {}, config };
}

function matchPath(url: string, pattern: string): Record<string, string> | null {
  const patternParts = pattern.split('/').filter(Boolean);
  const urlParts = url.split('?')[0].split('/').filter(Boolean);
  if (patternParts.length !== urlParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = urlParts[i];
    } else if (patternParts[i] !== urlParts[i]) {
      return null;
    }
  }
  return params;
}

export async function mockAdapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  await new Promise((r) => setTimeout(r, 180));

  const rawUrl = config.url || '';
  const url = rawUrl.startsWith('/') ? rawUrl : '/' + rawUrl;
  const method = (config.method || 'GET').toUpperCase();
  const params = config.params || {};

  // --- AUTH ---
  if (url === '/auth/me' && method === 'GET') return ok(config, MOCK_AUTH_ME);

  // --- ATTENDANCE ---
  if (url === '/attendance/me' && method === 'GET') return ok(config, MOCK_ATTENDANCE_TODAY);
  if (url === '/attendance/check-in' && method === 'POST') {
    return ok(config, { ...MOCK_ATTENDANCE_TODAY, checkIn: new Date().toISOString() });
  }
  if (url === '/attendance/check-out' && method === 'POST') {
    return ok(config, { ...MOCK_ATTENDANCE_TODAY, checkOut: new Date().toISOString() });
  }
  if (url === '/attendance/history' && method === 'GET') {
    return ok(config, generateMyAttendanceHistory(params.startDate || '2026-04-01', params.endDate || '2026-04-28'));
  }
  if (url === '/attendance/admin' && method === 'GET') {
    return ok(config, generateAdminAttendance(params.startDate || '2026-04-01', params.endDate || '2026-04-30'));
  }
  if (url === '/attendance/admin/export' && method === 'GET') {
    return ok(config, new Blob(['demo export'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  }
  if (matchPath(url, '/attendance/:id') && method === 'PATCH') return ok(config, { success: true });
  if (matchPath(url, '/attendance/:id/reset') && method === 'DELETE') return ok(config, { success: true });

  // --- ATTENDANCE CORRECTIONS ---
  if (url === '/attendance-corrections/me' && method === 'GET') return ok(config, MOCK_ATTENDANCE_CORRECTIONS_ME);
  if (url === '/attendance-corrections/admin' && method === 'GET') return ok(config, MOCK_ATTENDANCE_CORRECTIONS_ADMIN);
  if (url === '/attendance-corrections' && method === 'POST') return ok(config, { id: 'corr-new', status: 'PENDING' });
  if (matchPath(url, '/attendance-corrections/:id/approve') && method === 'PATCH') return ok(config, { success: true });
  if (matchPath(url, '/attendance-corrections/:id/reject') && method === 'PATCH') return ok(config, { success: true });
  if (matchPath(url, '/attendance-corrections/:id') && method === 'PATCH') return ok(config, { success: true });

  // --- ANNOUNCEMENTS ---
  if (url === '/announcements' && method === 'GET') return ok(config, MOCK_ANNOUNCEMENTS);
  if (url === '/announcements' && method === 'POST') {
    const newAnn = { id: `ann-new-${Date.now()}`, ...config.data, createdAt: new Date().toISOString(), imageS3Keys: [], reactions: [], comments: [] };
    return ok(config, newAnn);
  }
  const annDetailMatch = matchPath(url, '/announcements/:id');
  if (annDetailMatch && method === 'GET') {
    const found = MOCK_ANNOUNCEMENTS.find((a) => a.id === annDetailMatch.id);
    return ok(config, found || MOCK_ANNOUNCEMENTS[0]);
  }
  if (annDetailMatch && method === 'PATCH') return ok(config, { success: true });
  if (annDetailMatch && method === 'DELETE') return ok(config, { success: true });
  if (matchPath(url, '/announcements/:id/reaction') && method === 'POST') return ok(config, { success: true });
  if (matchPath(url, '/announcements/:id/comment') && method === 'POST') return ok(config, { id: `cmt-${Date.now()}`, content: config.data?.content, createdAt: new Date().toISOString() });
  if (matchPath(url, '/announcements/:id/comment/:cid') && method === 'DELETE') return ok(config, { success: true });

  // --- CALENDAR ---
  if (url === '/calendar/events' && method === 'GET') return ok(config, MOCK_CALENDAR_EVENTS);
  if (url === '/calendar/events' && method === 'POST') return ok(config, { id: `ce-new-${Date.now()}`, ...config.data, createdAt: new Date().toISOString() });
  if (matchPath(url, '/calendar/events/:id') && method === 'PATCH') return ok(config, { success: true });
  if (matchPath(url, '/calendar/events/:id') && method === 'DELETE') return ok(config, { success: true });
  if (url === '/calendar/memos' && method === 'GET') return ok(config, []);
  if (url === '/calendar/memos' && method === 'POST') return ok(config, { id: `memo-${Date.now()}`, ...config.data, createdAt: new Date().toISOString() });
  if (matchPath(url, '/calendar/memos/:id') && method === 'PATCH') return ok(config, { success: true });
  if (matchPath(url, '/calendar/memos/:id') && method === 'DELETE') return ok(config, { success: true });
  if (url === '/calendar/leaves' && method === 'GET') {
    return ok(config, generateCalendarLeaves(params.start || '2026-04-01', params.end || '2026-04-30'));
  }
  if (url === '/calendar/memo-reminders' && method === 'GET') return ok(config, MOCK_MEMO_REMINDERS);

  // --- HOLIDAYS ---
  if (url === '/holidays' && method === 'GET') return ok(config, MOCK_HOLIDAYS);
  if (url === '/holidays/sync' && method === 'POST') return ok(config, { created: 0, updated: 16 });

  // --- LEAVE ---
  if (url === '/leave/balance' && method === 'GET') return ok(config, MOCK_LEAVE_BALANCE);
  if (url === '/leave/requests' && method === 'GET') return ok(config, MOCK_MY_LEAVE_REQUESTS);
  if (url === '/leave/request' && method === 'POST') return ok(config, { id: `lr-new-${Date.now()}`, status: 'PENDING' });
  if (url === '/leave/notifications' && method === 'GET') return ok(config, MOCK_LEAVE_NOTIFICATIONS);
  if (url === '/leave/admin/requests' && method === 'GET') return ok(config, MOCK_LEAVE_REQUESTS_ADMIN);
  if (url === '/leave/admin/export' && method === 'GET') {
    return ok(config, new Blob(['demo export'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  }
  if (url === '/leave/approved-for-schedule' && method === 'GET') return ok(config, MOCK_APPROVED_FOR_SCHEDULE);
  if (matchPath(url, '/leave/requests/:id/approve') && method === 'PATCH') return ok(config, { success: true });
  if (matchPath(url, '/leave/requests/:id/reject') && method === 'PATCH') return ok(config, { success: true });
  if (matchPath(url, '/leave/requests/:id/revoke') && method === 'PATCH') return ok(config, { success: true });
  if (matchPath(url, '/leave/requests/:id') && method === 'DELETE') return ok(config, { success: true });

  // --- SCHEDULE ---
  if (url.startsWith('/schedule/projects') && method === 'GET') return ok(config, MOCK_SCHEDULE_PROJECTS);
  if (url === '/schedule/projects' && method === 'POST') {
    return ok(config, { id: `p-new-${Date.now()}`, ...config.data, tasks: [], createdAt: new Date().toISOString() });
  }
  if (matchPath(url, '/schedule/projects/:id') && method === 'PATCH') return ok(config, { success: true });
  if (matchPath(url, '/schedule/projects/:id') && method === 'DELETE') return ok(config, { success: true });
  if (url === '/schedule/tasks' && method === 'GET') {
    const allTasks = MOCK_SCHEDULE_PROJECTS.flatMap((p) => p.tasks);
    return ok(config, allTasks);
  }
  if (url === '/schedule/tasks' && method === 'POST') {
    return ok(config, { id: `t-new-${Date.now()}`, ...config.data, createdAt: new Date().toISOString() });
  }
  if (matchPath(url, '/schedule/tasks/:id') && method === 'PATCH') return ok(config, { success: true });
  if (matchPath(url, '/schedule/tasks/:id') && method === 'DELETE') return ok(config, { success: true });
  if (url === '/schedule/assignable-users' && method === 'GET') return ok(config, MOCK_ASSIGNABLE_USERS);
  if (url === '/schedule/personal-todos' && method === 'GET') return ok(config, MOCK_PERSONAL_TODOS);
  if (url === '/schedule/personal-todos' && method === 'POST') {
    return ok(config, { id: `todo-new-${Date.now()}`, title: config.data?.title, done: false });
  }
  if (matchPath(url, '/schedule/personal-todos/:id') && method === 'PATCH') return ok(config, { success: true });
  if (matchPath(url, '/schedule/personal-todos/:id') && method === 'DELETE') return ok(config, { success: true });

  // --- USERS ---
  if (url === '/users' && method === 'GET') return ok(config, MOCK_EMPLOYEES);
  if (url === '/users' && method === 'POST') {
    return ok(config, { id: `emp-new-${Date.now()}`, ...config.data, status: 'ACTIVE', createdAt: new Date().toISOString() });
  }
  if (matchPath(url, '/users/:id') && method === 'PATCH') return ok(config, { success: true });
  if (matchPath(url, '/users/:id') && method === 'DELETE') return ok(config, { success: true });
  if (matchPath(url, '/users/:id/leave-balance') && method === 'PATCH') return ok(config, { success: true });
  if (matchPath(url, '/users/:id/reset-password') && method === 'POST') return ok(config, { success: true });

  // Fallback: unknown endpoint
  console.warn(`[mockAdapter] No mock for ${method} ${url}`);
  return ok(config, null);
}
