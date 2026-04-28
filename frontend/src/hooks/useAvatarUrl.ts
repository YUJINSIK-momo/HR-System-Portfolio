import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

/**
 * 유저 아바타 presigned URL을 가져오는 훅.
 * avatarS3Key가 없으면 null 반환 (API 호출 안 함).
 * 5분 캐싱 — 같은 userId는 한 번만 호출.
 */
export function useAvatarUrl(userId: string | undefined, avatarS3Key: string | null | undefined): string | null {
  const { data } = useQuery({
    queryKey: ['avatar-url', userId, avatarS3Key],
    queryFn: async () => {
      const res = await api.get<{ url: string }>(`/users/${userId}/avatar-url`);
      return res.data.url;
    },
    enabled: !!userId && !!avatarS3Key,
    staleTime: 5 * 60 * 1000,   // 5분
    gcTime: 10 * 60 * 1000,     // 10분
    retry: false,
  });
  return data ?? null;
}
