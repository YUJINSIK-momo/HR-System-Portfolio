import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';
import { mockAdapter } from './mockAdapter';

const baseURL = import.meta.env.VITE_API_URL ?? '/api';
const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

// Intercept requests: use mock adapter when logged in with demo token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token === 'demo-token') {
    config.adapter = mockAdapter;
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
