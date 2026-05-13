import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import { NoticeImageCarousel, NoticeImageCarouselFrame } from '@/components/NoticeImageCarousel';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '👏', '🔥'] as const;

type CarouselImg = { id: string; imageUrl?: string | null };

export default function AnnouncementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useTranslation();
  const locale = lang === 'ja' ? 'ja-JP' : 'ko-KR';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isAdmin = useAuthStore(
    (s) =>
      s.user?.role === 'MANAGER' ||
      s.user?.role === 'SUPER_ADMIN' ||
      (s.user?.role === 'CS' && s.user?.position === 'CS총괄')
  );

  const [commentInput, setCommentInput] = useState('');
  const [carouselIdx, setCarouselIdx] = useState(0);

  const { data: a, isError, isLoading } = useQuery({
    queryKey: ['announcements', id],
    queryFn: () => api.get(`/announcements/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const reactionMutation = useMutation({
    mutationFn: ({ aid, emoji }: { aid: string; emoji: string }) =>
      api.post(`/announcements/${aid}/reaction`, { emoji }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements', id] });
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });

  const commentMutation = useMutation({
    mutationFn: ({ aid, content: c }: { aid: string; content: string }) =>
      api.post(`/announcements/${aid}/comment`, { content: c }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements', id] });
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      setCommentInput('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (aid: string) => api.delete(`/announcements/${aid}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      navigate('/announcements', { replace: true });
    },
  });

  const pinMutation = useMutation({
    mutationFn: ({ aid, pinned }: { aid: string; pinned: boolean }) =>
      api.patch(`/announcements/${aid}/pin`, { pinned }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements', id] });
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });

  const getReactionCounts = (reactions: any[]) => {
    const counts: Record<string, number> = {};
    const myReactions: Record<string, string> = {};
    reactions?.forEach((r: any) => {
      counts[r.emoji] = (counts[r.emoji] || 0) + 1;
      if (r.userId === currentUserId || r.user?.id === currentUserId) myReactions[r.emoji] = r.emoji;
    });
    return { counts, myReactions };
  };

  if (!id) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <p className="text-slate-600">{t('announcementNotFound')}</p>
        <Link to="/announcements" className="mt-4 inline-block text-violet-700 hover:underline">
          {t('announcementBackToList')}
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <p className="text-slate-500">{t('teamDesignLoading')}</p>
      </div>
    );
  }

  if (isError || !a) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <p className="text-slate-600">{t('announcementNotFound')}</p>
        <Link to="/announcements" className="mt-4 inline-block text-violet-700 hover:underline">
          {t('announcementBackToList')}
        </Link>
      </div>
    );
  }

  const { counts, myReactions } = getReactionCounts(a.reactions || []);
  const images = Array.isArray(a.images) ? a.images : [];

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-6">
        <Link
          to="/announcements"
          className="inline-flex items-center gap-2 text-sm font-medium text-violet-700 hover:text-violet-900"
        >
          <span aria-hidden className="text-lg leading-none">
            ←
          </span>
          {t('announcementBackToList')}
        </Link>
      </div>

      <article
        className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${
          a.isPinned ? 'border-amber-200 ring-1 ring-amber-100/80' : 'border-slate-200/90'
        }`}
      >
        {images.length > 0 && (
          <NoticeImageCarouselFrame>
            <NoticeImageCarousel
              images={images as CarouselImg[]}
              slideIndex={carouselIdx}
              onPrev={() => setCarouselIdx((i) => Math.max(0, i - 1))}
              onNext={() => setCarouselIdx((i) => Math.min(images.length - 1, i + 1))}
              ariaPrev={t('noticeCarouselPrev')}
              ariaNext={t('noticeCarouselNext')}
            />
          </NoticeImageCarouselFrame>
        )}

        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {a.isPinned && (
                  <span className="select-none text-lg leading-none" aria-hidden>
                    {t('noticePinnedBadge')}
                  </span>
                )}
                <h1 className="text-2xl font-bold leading-snug tracking-tight text-slate-900">{a.title}</h1>
              </div>
              <p className="text-sm text-slate-500">
                {a.author?.profile?.name || a.author?.email} · {new Date(a.createdAt).toLocaleString(locale)}
              </p>
            </div>
            {isAdmin && (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => pinMutation.mutate({ aid: a.id, pinned: !a.isPinned })}
                  className="inline-flex h-10 min-w-[2.5rem] items-center justify-center rounded-lg border border-amber-200/90 bg-white px-2.5 text-lg leading-none text-amber-700 shadow-sm transition hover:bg-amber-50"
                  aria-label={a.isPinned ? t('noticeUnpinAria') : t('noticePinAria')}
                >
                  {a.isPinned ? t('noticeUnpin') : t('noticePin')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(t('deleteConfirm'))) deleteMutation.mutate(a.id);
                  }}
                  className="inline-flex h-10 items-center rounded-lg border border-rose-200 bg-white px-3 text-sm font-medium text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-50"
                  aria-label={t('delete')}
                >
                  {t('delete')}
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-slate-100 pt-6">
            <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-700">{a.content}</p>
          </div>

          <div className="mt-8 border-t border-slate-100 pt-6">
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => reactionMutation.mutate({ aid: a.id, emoji })}
                  className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm transition-colors ${
                    myReactions[emoji]
                      ? 'bg-indigo-100 text-indigo-800'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>{emoji}</span>
                  {counts[emoji] > 0 && <span className="text-xs">{counts[emoji]}</span>}
                </button>
              ))}
            </div>

            <div className="mb-4 space-y-3">
              {a.comments?.map((c: any) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-sm sm:flex sm:flex-wrap sm:items-baseline sm:gap-x-2"
                >
                  <span className="font-medium text-slate-800">{c.user?.profile?.name || c.user?.email}</span>
                  <span className="text-slate-600">{c.content}</span>
                  <span className="text-xs text-slate-400 sm:ml-auto">{new Date(c.createdAt).toLocaleString(locale)}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const v = commentInput.trim();
                    if (v) commentMutation.mutate({ aid: a.id, content: v });
                  }
                }}
                placeholder={t('inputComment')}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600/30"
              />
              <button
                type="button"
                onClick={() => {
                  const v = commentInput.trim();
                  if (v) commentMutation.mutate({ aid: a.id, content: v });
                }}
                disabled={!commentInput.trim() || commentMutation.isPending}
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-slate-300"
              >
                {t('submit')}
              </button>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
