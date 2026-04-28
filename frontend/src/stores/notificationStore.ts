import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface NotificationState {
  lastLeaveReadAt: number;
  lastMemoReadAt: number;
  lastAnnouncementReadAt: number;
  setLastLeaveReadAt: (ts?: number) => void;
  setLastMemoReadAt: (ts?: number) => void;
  setLastAnnouncementReadAt: (ts?: number) => void;
}

type PersistShape = Partial<NotificationState> & { lastNotificationsReadAt?: number };

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      lastLeaveReadAt: 0,
      lastMemoReadAt: 0,
      lastAnnouncementReadAt: 0,
      setLastLeaveReadAt: (ts) => set({ lastLeaveReadAt: ts ?? Date.now() }),
      setLastMemoReadAt: (ts) => set({ lastMemoReadAt: ts ?? Date.now() }),
      setLastAnnouncementReadAt: (ts) => set({ lastAnnouncementReadAt: ts ?? Date.now() }),
    }),
    {
      name: 'notification-storage',
      merge: (persisted, current) => {
        const p = persisted as PersistShape;
        const legacy = p.lastNotificationsReadAt ?? 0;
        return {
          ...current,
          ...p,
          lastLeaveReadAt: p.lastLeaveReadAt ?? legacy,
          lastMemoReadAt: p.lastMemoReadAt ?? legacy,
          lastAnnouncementReadAt: p.lastAnnouncementReadAt ?? legacy,
        };
      },
    }
  )
);
