import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

const DEMO_EMAIL = 'admin@jinsik.com';
const DEMO_PASSWORD = 'jinsik2036';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (email.trim().toLowerCase() === DEMO_EMAIL && password.trim() === DEMO_PASSWORD) {
      localStorage.setItem('demo-auth', 'true');
      setAuth('demo-token', {
        id: 'demo-admin',
        email: DEMO_EMAIL,
        name: '관리자',
        role: 'SUPER_ADMIN',
      });
      navigate('/', { replace: true });
    } else {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-notion-navy flex items-center justify-center p-4">
      {/* Decorative background dots — Notion hero style */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-40 h-40 rounded-full bg-violet-600/10 blur-3xl" />
        <div className="absolute bottom-32 right-24 w-56 h-56 rounded-full bg-violet-500/8 blur-3xl" />
        <div className="absolute top-1/2 left-1/3 w-32 h-32 rounded-full bg-blue-500/6 blur-2xl" />
      </div>

      <div className="relative w-full max-w-md space-y-5">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-notion-card bg-violet-600 shadow-notion-hero mb-5">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            HR System Portfolio
          </h1>
          <p className="mt-2 text-sm text-white/50">
            사내 근태 · 연차 · 일정 관리 대시보드
          </p>
        </div>

        {/* Login card */}
        <div className="bg-notion-canvas rounded-notion-card shadow-notion-hero border border-notion-hairline p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-notion-charcoal mb-1.5 tracking-tight">
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-notion-hairline-strong rounded-notion-btn px-3.5 py-2.5 text-sm text-notion-charcoal placeholder:text-notion-muted focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent transition-all bg-notion-canvas"
                placeholder="admin@jinsik.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-notion-charcoal mb-1.5 tracking-tight">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-notion-hairline-strong rounded-notion-btn px-3.5 py-2.5 text-sm text-notion-charcoal placeholder:text-notion-muted focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent transition-all bg-notion-canvas"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-notion-btn bg-red-50 border border-red-100 px-3.5 py-2.5">
                <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-violet-700 hover:bg-violet-800 text-white font-medium py-2.5 rounded-notion-btn text-sm transition-colors shadow-sm mt-1"
            >
              로그인
            </button>
          </form>
        </div>

        {/* Demo account — Notion tint-yellow-bold style */}
        <div className="rounded-notion-card border border-notion-hairline bg-notion-tint-yellow-bold/60 backdrop-blur-sm px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-3.5 h-3.5 text-amber-700" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-800">관리자 데모 계정</p>
          </div>
          <div className="space-y-1.5 mb-3">
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-semibold text-amber-700 w-5">ID</span>
              <code className="text-sm font-mono font-medium text-amber-900 bg-white/70 px-2 py-0.5 rounded-md border border-amber-200/50">
                {DEMO_EMAIL}
              </code>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-semibold text-amber-700 w-5">PW</span>
              <code className="text-sm font-mono font-medium text-amber-900 bg-white/70 px-2 py-0.5 rounded-md border border-amber-200/50">
                {DEMO_PASSWORD}
              </code>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setEmail(DEMO_EMAIL);
              setPassword(DEMO_PASSWORD);
            }}
            className="w-full text-xs font-medium text-amber-800 bg-white/60 hover:bg-white/80 border border-amber-200/60 rounded-notion-btn py-1.5 transition-colors"
          >
            데모 계정으로 자동 입력
          </button>
        </div>
      </div>
    </div>
  );
}
