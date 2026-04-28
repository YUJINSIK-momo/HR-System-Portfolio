import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import { NoticeImageCarousel } from '@/components/NoticeImageCarousel';

const PAGE_SIZE = 10;
const MAX_NOTICE_IMAGES = 20;

type PendingImage = { s3Key: string; previewUrl: string };
type EditExistingImage = { s3Key: string; imageUrl?: string | null };

function formatAnnouncementTableDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}.${mo}.${day} ${h}:${min}`;
}

const LABEL_CLS = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';
const INPUT_CLS =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition';

export default function AnnouncementsPage() {
  const { t } = useTranslation();
  const [modalMode, setModalMode] = useState<'none' | 'create' | 'edit'>('none');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editExistingImages, setEditExistingImages] = useState<EditExistingImage[]>([]);
  const [page, setPage] = useState(1);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [createPinned, setCreatePinned] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState('');
  const [previewCarouselIdx, setPreviewCarouselIdx] = useState(0);
  const queryClient = useQueryClient();
  const isAdmin = useAuthStore(
    (s) =>
      s.user?.role === 'MANAGER' ||
      s.user?.role === 'SUPER_ADMIN' ||
      (s.user?.role === 'CS' && s.user?.position === 'CS총괄')
  );

  const { data: announcements } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => api.get('/announcements').then((r) => r.data),
  });

  const closeModal = () => {
    setModalMode('none');
    setEditingId(null);
    setTitle('');
    setContent('');
    setEditExistingImages([]);
    setPendingImages((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      return [];
    });
    setCreatePinned(false);
    setError('');
    setPreviewCarouselIdx(0);
  };

  const createMutation = useMutation({
    mutationFn: (data: { title: string; content: string; imageS3Keys?: string[]; isPinned?: boolean }) =>
      api.post('/announcements', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      closeModal();
    },
    onError: (err: any) => setError(err.response?.data?.message || '오류가 발생했습니다.'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; title: string; content: string; imageS3Keys: string[]; isPinned?: boolean }) =>
      api.patch(`/announcements/${data.id}`, {
        title: data.title,
        content: data.content,
        imageS3Keys: data.imageS3Keys,
        isPinned: data.isPinned,
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcements', vars.id] });
      closeModal();
    },
    onError: (err: any) => setError(err.response?.data?.message || t('noticeEditFailed')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/announcements/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['announcements'] }),
  });

  const pinMutation = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      api.patch(`/announcements/${id}/pin`, { pinned }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['announcements'] }),
  });

  const onPickImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    if (files.length === 0) {
      if ((e.target.files?.length ?? 0) > 0) setError(t('noticeImageInvalid'));
      return;
    }
    const used =
      modalMode === 'edit' ? editExistingImages.length + pendingImages.length : pendingImages.length;
    const room = MAX_NOTICE_IMAGES - used;
    if (room <= 0) { setError(t('noticeImagesMax')); return; }
    const toAdd = files.slice(0, room);
    setError('');
    setUploadingImage(true);
    try {
      const next: PendingImage[] = [];
      for (const file of toAdd) {
        const { data: presign } = await api.post('/announcements/presign-upload', {
          filename: file.name,
          mimeType: file.type,
        });
        await fetch(presign.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
        next.push({ s3Key: presign.s3Key, previewUrl: URL.createObjectURL(file) });
      }
      setPendingImages((prev) => [...prev, ...next]);
    } catch (err: any) {
      setError(err.response?.data?.message || t('noticeImageUploadFailed'));
    } finally {
      setUploadingImage(false);
    }
  };

  const removePendingAt = (index: number) => {
    setPendingImages((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      setPreviewCarouselIdx((cur) => {
        if (index < cur) return cur - 1;
        if (cur >= copy.length) return Math.max(0, copy.length - 1);
        return cur;
      });
      return copy;
    });
  };

  const clearAllPendingImages = () => {
    pendingImages.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPendingImages([]);
    setPreviewCarouselIdx(0);
  };

  const removeSlideAt = (idx: number) => {
    if (modalMode !== 'edit') { removePendingAt(idx); return; }
    const nEx = editExistingImages.length;
    if (idx < nEx) {
      setEditExistingImages((prev) => prev.filter((_, i) => i !== idx));
    } else {
      removePendingAt(idx - nEx);
    }
  };

  const carouselItems = useMemo(() => {
    if (modalMode === 'edit') {
      return [
        ...editExistingImages.map((im, i) => ({ id: `ex-${im.s3Key}-${i}`, imageUrl: im.imageUrl ?? undefined })),
        ...pendingImages.map((p, i) => ({ id: `pd-${p.s3Key}-${i}`, imageUrl: p.previewUrl })),
      ];
    }
    return pendingImages.map((p, i) => ({ id: `${p.s3Key}-${i}`, imageUrl: p.previewUrl }));
  }, [modalMode, editExistingImages, pendingImages]);

  const list: any[] = announcements || [];
  const pinnedList = list.filter((x) => x.isPinned);
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const paginated = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const unpinnedList = useMemo(() => list.filter((x) => !x.isPinned), [list]);
  const numberById = useMemo(() => {
    const m = new Map<string, number>();
    unpinnedList.forEach((a, i) => m.set(a.id, unpinnedList.length - i));
    return m;
  }, [unpinnedList]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [list.length, page, totalPages]);

  useEffect(() => {
    setPreviewCarouselIdx((i) => {
      const total =
        modalMode === 'edit' ? editExistingImages.length + pendingImages.length : pendingImages.length;
      return Math.min(Math.max(0, i), Math.max(0, total - 1));
    });
  }, [modalMode, editExistingImages.length, pendingImages.length]);

  return (
    <div className="min-h-full bg-slate-50 p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('announcements')}</h1>
          <p className="mt-1 text-sm text-slate-500">사내 공지사항을 확인하고 관리합니다</p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              setModalMode('create');
              setEditingId(null);
              setEditExistingImages([]);
              setTitle('');
              setContent('');
              setPendingImages((prev) => { prev.forEach((p) => URL.revokeObjectURL(p.previewUrl)); return []; });
              setCreatePinned(false);
              setPreviewCarouselIdx(0);
              setError('');
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition hover:from-indigo-700 hover:to-violet-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {t('writeNotice')}
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">전체 공지</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{list.length}</p>
          <p className="mt-1 text-xs text-slate-500">등록된 공지사항</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">중요 공지</p>
          <p className="mt-2 text-3xl font-bold text-amber-600">{pinnedList.length}</p>
          <p className="mt-1 text-xs text-slate-500">상단 고정 중</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5 hidden sm:block">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">현재 페이지</p>
          <p className="mt-2 text-3xl font-bold text-indigo-600">{page}<span className="text-lg text-slate-400"> / {totalPages}</span></p>
          <p className="mt-1 text-xs text-slate-500">페이지 {page}</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
        {list.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
              <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-600">등록된 공지사항이 없습니다</p>
            <p className="mt-1 text-xs text-slate-400">새 공지를 작성해 주세요</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="w-20 px-4 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">번호</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">제목</th>
                  <th className="w-28 px-4 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">작성자</th>
                  <th className="w-36 px-4 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">작성일</th>
                  {isAdmin && (
                    <th className="w-48 px-4 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">관리</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginated.map((a: any) => (
                  <tr key={a.id} className="group hover:bg-indigo-50/40 transition-colors">
                    <td className="px-4 py-3.5 text-center align-middle">
                      {a.isPinned ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-100">
                          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          중요
                        </span>
                      ) : (
                        <span className="tabular-nums text-slate-500 text-xs">{numberById.get(a.id) ?? '—'}</span>
                      )}
                    </td>
                    <td className="max-w-0 px-4 py-3.5 align-middle">
                      <Link
                        to={`/announcements/${a.id}`}
                        className="flex items-center gap-2 font-medium text-slate-900 hover:text-indigo-700 transition-colors"
                      >
                        {a.isPinned && (
                          <span className="shrink-0 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600 ring-1 ring-indigo-100">
                            공지
                          </span>
                        )}
                        <span className="truncate group-hover:text-indigo-700">{a.title}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-center align-middle">
                      <span className="text-xs text-slate-600 truncate block">
                        {a.author?.profile?.name || a.author?.email || '—'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-center align-middle tabular-nums text-xs text-slate-500">
                      {formatAnnouncementTableDate(a.createdAt)}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3.5 align-middle" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => pinMutation.mutate({ id: a.id, pinned: !a.isPinned })}
                            className={`inline-flex h-7 items-center rounded-lg border px-2 text-xs font-medium shadow-sm transition ${
                              a.isPinned
                                ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {a.isPinned ? '고정 해제' : '📌 고정'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setModalMode('edit');
                              setEditingId(a.id);
                              setTitle(a.title);
                              setContent(a.content);
                              setCreatePinned(!!a.isPinned);
                              setEditExistingImages(
                                (a.images || []).map((im: { s3Key: string; imageUrl?: string | null }) => ({
                                  s3Key: im.s3Key,
                                  imageUrl: im.imageUrl,
                                }))
                              );
                              setPendingImages((prev) => { prev.forEach((p) => URL.revokeObjectURL(p.previewUrl)); return []; });
                              setPreviewCarouselIdx(0);
                              setError('');
                            }}
                            className="inline-flex h-7 items-center rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => { if (confirm(t('deleteConfirm'))) deleteMutation.mutate(a.id); }}
                            className="inline-flex h-7 items-center rounded-lg border border-rose-200 bg-white px-2 text-xs font-medium text-rose-600 shadow-sm transition hover:bg-rose-50"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            전체 <span className="font-semibold text-slate-700">{list.length}</span>건
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-sm text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition ${
                  p === page
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-sm text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalMode !== 'none' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-base font-bold text-slate-900">
                {modalMode === 'edit' ? '공지사항 수정' : '새 공지사항 작성'}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className={LABEL_CLS}>제목</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={INPUT_CLS}
                  placeholder="공지 제목을 입력하세요"
                />
              </div>

              <div>
                <label className={LABEL_CLS}>내용</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={5}
                  className={`${INPUT_CLS} resize-none`}
                  placeholder="공지 내용을 입력하세요"
                />
              </div>

              <div>
                <label className={LABEL_CLS}>이미지 첨부 (선택)</label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={onPickImages}
                      disabled={
                        uploadingImage ||
                        (modalMode === 'edit' ? editExistingImages.length : 0) + pendingImages.length >= MAX_NOTICE_IMAGES
                      }
                    />
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {uploadingImage ? '업로드 중...' : '이미지 선택'}
                  </label>
                  {pendingImages.length > 0 && (
                    <button type="button" onClick={clearAllPendingImages} className="text-xs text-rose-500 hover:underline">
                      전체 제거
                    </button>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-slate-400">최대 {MAX_NOTICE_IMAGES}장까지 첨부 가능</p>
                {carouselItems.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2">
                      <NoticeImageCarousel
                        images={carouselItems}
                        slideIndex={previewCarouselIdx}
                        onPrev={() => setPreviewCarouselIdx((i) => Math.max(0, i - 1))}
                        onNext={() => setPreviewCarouselIdx((i) => Math.min(Math.max(0, carouselItems.length - 1), i + 1))}
                        ariaPrev={t('noticeCarouselPrev')}
                        ariaNext={t('noticeCarouselNext')}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSlideAt(previewCarouselIdx)}
                      className="text-xs text-rose-500 hover:underline"
                    >
                      현재 이미지 제거
                    </button>
                  </div>
                )}
              </div>

              <label className="flex cursor-pointer select-none items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={createPinned}
                  onChange={(e) => setCreatePinned(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-700 font-medium">상단 고정 (중요 공지)</span>
              </label>

              {error && (
                <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3">
                  <p className="text-sm text-rose-700">{error}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  if (modalMode === 'edit' && editingId) {
                    const keys = [...editExistingImages.map((x) => x.s3Key), ...pendingImages.map((p) => p.s3Key)];
                    updateMutation.mutate({ id: editingId, title, content, imageS3Keys: keys, isPinned: createPinned });
                  } else {
                    createMutation.mutate({
                      title,
                      content,
                      imageS3Keys: pendingImages.length ? pendingImages.map((p) => p.s3Key) : undefined,
                      isPinned: createPinned,
                    });
                  }
                }}
                disabled={
                  createMutation.isPending || updateMutation.isPending || !title.trim() || !content.trim() || uploadingImage
                }
                className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {createMutation.isPending || updateMutation.isPending ? '처리 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
