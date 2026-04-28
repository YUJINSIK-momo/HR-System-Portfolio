import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import AttendancePage from '@/pages/AttendancePage';
import LeavePage from '@/pages/LeavePage';
import CalendarPage from '@/pages/CalendarPage';
import GeminiPage from '@/pages/GeminiPage';
import AnnouncementsPage from '@/pages/AnnouncementsPage';
import AnnouncementDetailPage from '@/pages/AnnouncementDetailPage';
import SchedulePage from '@/pages/SchedulePage';
import NotificationsPage from '@/pages/NotificationsPage';
import AdminUsersPage from '@/pages/admin/AdminUsersPage';
import AdminAttendancePage from '@/pages/admin/AdminAttendancePage';
import AdminLeavePage from '@/pages/admin/AdminLeavePage';
import Layout from '@/components/Layout';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const isDemoAuthenticated = localStorage.getItem('demo-auth') === 'true';
  if (!token && !isDemoAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="leave" element={<LeavePage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="gemini" element={<GeminiPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="announcements/:id" element={<AnnouncementDetailPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="admin/users" element={<AdminUsersPage />} />
          <Route path="admin/attendance" element={<AdminAttendancePage />} />
          <Route path="admin/leave" element={<AdminLeavePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
