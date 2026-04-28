import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';
import { mockAdapter } from './mockAdapter';

const baseURL = import.meta.env.VITE_API_URL ?? '/api';
const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

/** zustand persist 복원 전에도 알 수 있도록 (깃헙 페이지 최초 요청 깨짐 방지) */
function readPersistedToken(): string | null {
  try {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { token?: string | null } };
    const t = parsed?.state?.token;
    return typeof t === 'string' ? t : null;
  } catch {
    return null;
  }
}

/**
 * 포트폴리오/GitHub Pages: 백엔드 없음 → 항상 mock.
 * 로컬 dev에서는 실 JWT로 백엔드·DB 연동 유지 가능.
 */
function shouldForceMockRequests(): boolean {
  if (import.meta.env.VITE_FORCE_MOCK === 'true') return true;
  if (!import.meta.env.PROD) return false;
  const base = import.meta.env.BASE_URL || '/';
  return base.includes('HR-System-Portfolio');
}

// Intercept requests: mock 어댑터 (데모 세션 또는 포트폴리오 정적 배포)
api.interceptors.request.use((config) => {
  const storeToken = useAuthStore.getState().token;
  const token = storeToken ?? readPersistedToken();
  const demoSession =
    token === 'demo-token' ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('demo-auth') === 'true');

  if (shouldForceMockRequests() || demoSession) {
    config.adapter = mockAdapter;
    delete config.headers.Authorization;
  } else if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
      const base = import.meta.env.BASE_URL.replace(/\/$/, '');
      window.location.href = `${base}/login`;
    }
    return Promise.reject(err);
  }
);

export default api;
