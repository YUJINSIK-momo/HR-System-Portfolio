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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">HR System Portfolio</h1>
          <p className="mt-1 text-sm text-slate-500">사내 근태/연차/일정 관리 대시보드</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                placeholder="admin@jinsik.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3.5 py-2.5 rounded-xl">{error}</p>
            )}

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors shadow-sm"
            >
              로그인
            </button>
          </form>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-3">관리자 데모 계정</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-600 w-6">ID</span>
              <code className="text-sm font-mono font-medium text-amber-900 bg-amber-100 px-2 py-0.5 rounded-lg">
                {DEMO_EMAIL}
              </code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-600 w-6">PW</span>
              <code className="text-sm font-mono font-medium text-amber-900 bg-amber-100 px-2 py-0.5 rounded-lg">
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
            className="mt-3 w-full text-xs font-medium text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 py-1.5 rounded-lg transition-colors"
          >
            데모 계정으로 자동 입력
          </button>
        </div>
      </div>
    </div>
  );
}
