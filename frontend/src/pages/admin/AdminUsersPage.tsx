import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';

/** 0.25 단위 반반차 등 반영 — DB는 Float */
function parseLeaveDaysInput(raw: string): number | null {
  const s = raw.trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function formatLeaveDaysDisplay(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 100) / 100;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(rounded);
}

export default function AdminUsersPage() {
  const { t } = useTranslation();
  const isSuperAdmin = useAuthStore((s) => s.user?.role === 'SUPER_ADMIN');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'EMPLOYEE', position: '', phone: '', hireDate: '', leaveDays: '', useJapanese: false });
  const [error, setError] = useState('');
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [leaveTarget, setLeaveTarget] = useState<{ id: string; name: string; currentDays: number } | null>(null);
  const [leaveDays, setLeaveDays] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [editTarget, setEditTarget] = useState<{
    id: string;
    name: string;
    position?: string;
    phone?: string;
    hireDate?: string;
    useJapanese: boolean;
    role?: string;
  } | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    position: '',
    phone: '',
    hireDate: '',
    useJapanese: false,
    role: 'EMPLOYEE',
  });
  const queryClient = useQueryClient();

  const updateUser = useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      position?: string;
      phone?: string;
      hireDate?: string | null;
      useJapanese?: boolean;
      role?: string;
    }) => api.patch(`/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditTarget(null);
    },
    onError: (err: any) => setError(err.response?.data?.message || '오류가 발생했습니다.'),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  });

  const createUser = useMutation({
    mutationFn: (data: typeof form) =>
      api.post('/users', {
        ...data,
        hireDate: data.hireDate || undefined,
        leaveDays: data.leaveDays ? parseLeaveDaysInput(data.leaveDays) ?? undefined : undefined,
        useJapanese: data.useJapanese,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowCreate(false);
      setForm({ email: '', password: '', name: '', role: 'EMPLOYEE', position: '', phone: '', hireDate: '', leaveDays: '', useJapanese: false });
    },
    onError: (err: any) => setError(err.response?.data?.message || '오류가 발생했습니다.'),
  });

  const setLeave = useMutation({
    mutationFn: ({ id, totalDays }: { id: string; totalDays: number }) =>
      api.patch(`/users/${id}/leave-balance`, { totalDays }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setLeaveTarget(null);
      setLeaveDays('');
    },
    onError: (err: any) => setError(err.response?.data?.message || '오류가 발생했습니다.'),
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleteTarget(null);
    },
    onError: (err: any) => setError(err.response?.data?.message || '오류가 발생했습니다.'),
  });

  const resetPass = useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      api.post(`/users/${id}/reset-password`, { newPassword }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setResetId(null);
      setResetPassword('');
    },
    onError: (err: any) => setError(err.response?.data?.message || '오류가 발생했습니다.'),
  });

  return (
    <div className="p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">{t('employeeMgmt')}</h2>
        <button onClick={() => setShowCreate(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
          {t('addEmployee')}
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4">{t('addEmployee')}</h3>
            <div className="space-y-3">
              {[
                { key: 'email', label: t('email'), type: 'email' },
                { key: 'password', label: t('tempPassword'), type: 'password' },
                { key: 'name', label: t('name'), type: 'text' },
                { key: 'position', label: t('position'), type: 'text' },
                { key: 'phone', label: t('phone'), type: 'text' },
                { key: 'hireDate', label: t('hireDate'), type: 'date' },
                { key: 'leaveDays', label: t('leaveDays'), type: 'number' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {label}
                          {(key === 'hireDate' || key === 'leaveDays') && <span className="text-gray-400 font-normal ml-1">{t('optional')}</span>}
                  </label>
                  {key === 'leaveDays' && <p className="text-xs text-gray-500 mt-0.5">{t('leaveDaysNote')}</p>}
                  <input
                    type={type}
                    value={String((form as Record<string, unknown>)[key] ?? '')}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={key === 'leaveDays' ? '0' : undefined}
                    min={key === 'leaveDays' ? 0 : undefined}
                    step={key === 'leaveDays' ? '0.25' : undefined}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('role')}</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="EMPLOYEE">{t('employee')}</option>
                  <option value="PLANNING">{t('planning')}</option>
                  <option value="MANAGER">{t('manager')}</option>
                  <option value="SUPER_ADMIN">{t('rep')}</option>
                  <option value="CS">{t('cs')}</option>
                  <option value="DESIGNER">{t('designer')}</option>
                  <option value="FOREIGN_FREELANCER">{t('foreignFreelancer')}</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useJapanese"
                  checked={form.useJapanese}
                  onChange={(e) => setForm({ ...form, useJapanese: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="useJapanese" className="text-sm font-medium text-gray-700">{t('useJapanese')}</label>
              </div>
            </div>
            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
            <div className="flex gap-2 mt-5">
              <button onClick={() => { setShowCreate(false); setError(''); }} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">{t('cancel')}</button>
              <button onClick={() => createUser.mutate(form)} disabled={createUser.isPending} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium">
                {createUser.isPending ? '추가 중...' : t('add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 편집 모달 */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4">{t('editEmployee')}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('name')}</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('position')}</label>
                <input
                  type="text"
                  value={editForm.position}
                  onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('phone')}</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('hireDate')}</label>
                <input
                  type="date"
                  value={editForm.hireDate}
                  onChange={(e) => setEditForm({ ...editForm, hireDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="editUseJapanese"
                  checked={editForm.useJapanese}
                  onChange={(e) => setEditForm({ ...editForm, useJapanese: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="editUseJapanese" className="text-sm font-medium text-gray-700">{t('useJapanese')}</label>
              </div>
              {isSuperAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('role')}</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="EMPLOYEE">{t('employee')}</option>
                    <option value="PLANNING">{t('planning')}</option>
                    <option value="MANAGER">{t('manager')}</option>
                    <option value="SUPER_ADMIN">{t('rep')}</option>
                    <option value="CS">{t('cs')}</option>
                    <option value="DESIGNER">{t('designer')}</option>
                    <option value="FOREIGN_FREELANCER">{t('foreignFreelancer')}</option>
                  </select>
                </div>
              )}
            </div>
            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
            <div className="flex gap-2 mt-5">
              <button onClick={() => { setEditTarget(null); setError(''); }} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">{t('cancel')}</button>
              <button
                onClick={() =>
                  updateUser.mutate({
                    id: editTarget.id,
                    name: editForm.name,
                    position: editForm.position,
                    phone: editForm.phone,
                    hireDate: editForm.hireDate || null,
                    useJapanese: editForm.useJapanese,
                    ...(isSuperAdmin ? { role: editForm.role } : {}),
                  })
                }
                disabled={updateUser.isPending}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium"
              >
                {updateUser.isPending ? t('saving') : t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 연차 설정 모달 */}
      {leaveTarget && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              {t('leaveSetting')} - {leaveTarget.name}
            </h3>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('leaveDays')}</label>
            <p className="text-xs text-gray-500 mb-2">{t('leaveDaysFractionHint')}</p>
            <input
              type="number"
              min={0}
              step={0.25}
              inputMode="decimal"
              value={leaveDays}
              onChange={(e) => setLeaveDays(e.target.value)}
              placeholder={String(leaveTarget.currentDays)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => { setLeaveTarget(null); setError(''); setLeaveDays(''); }}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm"
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => {
                  const parsed = leaveDays.trim() === '' ? leaveTarget.currentDays : parseLeaveDaysInput(leaveDays);
                  if (parsed === null) return;
                  setLeave.mutate({ id: leaveTarget.id, totalDays: parsed });
                }}
                disabled={
                  setLeave.isPending ||
                  (leaveDays.trim() !== '' && parseLeaveDaysInput(leaveDays) === null)
                }
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium"
              >
                {setLeave.isPending ? t('saving') : t('set')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 직원 계정 삭제 모달 */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-gray-800 mb-2">{t('delete')}</h3>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{deleteTarget.name}</strong> {t('deleteUserConfirm')}
            </p>
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-5">
              {t('deleteUserNote')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { setDeleteTarget(null); setError(''); }}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium"
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => deleteUser.mutate(deleteTarget.id)}
                disabled={deleteUser.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-sm font-medium"
              >
                {deleteUser.isPending ? t('processing') : t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {resetId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4">{t('passwordReset')}</h3>
            <input
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder={t('newPassword')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4"
            />
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setResetId(null); setError(''); }} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">{t('cancel')}</button>
              <button onClick={() => resetPass.mutate({ id: resetId, newPassword: resetPassword })} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium">{t('resetPasswordBtn')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Users table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500">{t('name')}</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500">{t('email')}</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500">{t('position')}</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500">{t('leaveBalance')}</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500">{t('role')}</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500">{t('status')}</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500">{t('action')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users?.map((u: any) => {
              const lb = u.leaveBalance;
              const total = lb?.totalDays ?? 0;
              const used = lb?.usedDays ?? 0;
              const remaining = total - used;
              return (
                <tr key={u.id}>
                  <td className="px-6 py-3 font-medium text-gray-800">{u.name}</td>
                  <td className="px-6 py-3 text-gray-600">{u.email}</td>
                  <td className="px-6 py-3 text-gray-600">{u.position || '-'}</td>
                  <td className="px-6 py-3 text-gray-600">
                    <span title={`${t('total')} ${formatLeaveDaysDisplay(total)}${t('days')} · ${t('used')} ${formatLeaveDaysDisplay(used)}${t('days')}`}>
                      {formatLeaveDaysDisplay(remaining)}{t('days')}
                    </span>
                    <button
                      onClick={() => {
                        setLeaveTarget({ id: u.id, name: u.name, currentDays: total });
                        setLeaveDays('');
                        setError('');
                      }}
                      className="ml-1 text-xs text-blue-600 hover:underline"
                    >
                      {t('set')}
                    </button>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      {u.role === 'EMPLOYEE'
                        ? t('employee')
                        : u.role === 'PLANNING'
                          ? t('planning')
                          : u.role === 'MANAGER'
                            ? t('manager')
                            : u.role === 'SUPER_ADMIN'
                              ? t('rep')
                              : u.role === 'CS'
                                ? t('cs')
                                : u.role === 'DESIGNER'
                                  ? t('designer')
                                  : u.role === 'FOREIGN_FREELANCER'
                                    ? t('foreignFreelancer')
                                    : u.role}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    {!u.isActive
                      ? <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{t('inactive')}</span>
                      : u.forcePasswordChange
                        ? <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">{t('passwordChangeRequired')}</span>
                        : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{t('normal')}</span>
                    }
                  </td>
                  <td className="px-6 py-3 space-x-2">
                    <button
                      onClick={() => {
                        setEditTarget({
                          id: u.id,
                          name: u.name ?? '',
                          position: u.position,
                          phone: u.phone,
                          hireDate: u.hireDate,
                          useJapanese: (u.preferredLanguage ?? 'ko') === 'ja',
                          role: u.role,
                        });
                        setEditForm({
                          name: u.name ?? '',
                          position: u.position ?? '',
                          phone: u.phone ?? '',
                          hireDate: u.hireDate ? new Date(u.hireDate).toISOString().slice(0, 10) : '',
                          useJapanese: (u.preferredLanguage ?? 'ko') === 'ja',
                          role: u.role ?? 'EMPLOYEE',
                        });
                        setError('');
                      }}
                      className="text-xs text-gray-600 hover:underline"
                    >
                      {t('edit')}
                    </button>
                    <button onClick={() => { setResetId(u.id); setError(''); }} className="text-xs text-gray-600 hover:underline">
                      {t('passwordReset')}
                    </button>
                    {isSuperAdmin && (
                      <button onClick={() => setDeleteTarget({ id: u.id, name: u.name })} className="text-xs text-red-600 hover:underline">
                        {t('delete')}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
