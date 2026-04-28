import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'EMPLOYEE' | 'PLANNING' | 'MANAGER' | 'SUPER_ADMIN' | 'CS' | 'DESIGNER' | 'FOREIGN_FREELANCER';
  preferredLanguage?: 'ko' | 'ja';
  position?: string | null;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  setUser: (updates: Partial<User>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      setUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'auth-storage' }
  )
);
