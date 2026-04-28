import prisma from '../lib/prisma';
import { ensureDesignNotificationChannels, ensureDraftNotificationChannels } from './designRequestNotify.service';

/** 디자이너·대표·해외 디자이너만 — 프론트 `SPORT_TEAM_CHANNEL_SLUGS`와 동일 slug */
const SPORT_TEAM_ALLOWED_ROLES = ['DESIGNER', 'SUPER_ADMIN', 'FOREIGN_FREELANCER'] as const;

/** 프론트 ChatPage `SPORT_TEAM_CHANNEL_SLUGS`와 동일 — 종목별 일반 대화 채널 */
const SPORT_TEAM_CHANNELS: { slug: string; name: string; order: number }[] = [
  { slug: 'soccer', name: '축구', order: 10 },
  { slug: 'basketball', name: '농구', order: 11 },
  { slug: 'baseball', name: '야구', order: 12 },
  { slug: 'baseball-hof', name: '야구(HOF)', order: 13 },
  { slug: 'volleyball', name: '배구', order: 14 },
];

/** 종목별 일반 채팅(전 직원 멘션 가능) — `chat.controller` `SPORT_CHAT_SLUGS`와 동일 slug */
const SPORT_CHAT_CHANNELS: { slug: string; name: string; order: number }[] = [
  { slug: 'soccer-chat', name: '축구(채팅)', order: 5 },
  { slug: 'basketball-chat', name: '농구(채팅)', order: 6 },
  { slug: 'baseball-chat', name: '야구(채팅)', order: 7 },
  { slug: 'baseball-hof-chat', name: '야구(HOF채팅)', order: 8 },
  { slug: 'volleyball-chat', name: '배구(채팅)', order: 9 },
];

async function ensureSportTeamChannels(): Promise<void> {
  const allowedJson = [...SPORT_TEAM_ALLOWED_ROLES];
  for (const ch of SPORT_TEAM_CHANNELS) {
    await prisma.chatChannel.upsert({
      where: { slug: ch.slug },
      create: {
        slug: ch.slug,
        name: ch.name,
        order: ch.order,
        type: 'PUBLIC',
        allowedRoles: allowedJson,
      } as any,
      update: { name: ch.name, order: ch.order, allowedRoles: allowedJson },
    });
  }
}

/** 전 직원 접근·멘션 가능(allowed_roles null → chat.controller 기본 규칙) */
async function ensureSportChatChannels(): Promise<void> {
  for (const ch of SPORT_CHAT_CHANNELS) {
    await prisma.chatChannel.upsert({
      where: { slug: ch.slug },
      create: {
        slug: ch.slug,
        name: ch.name,
        order: ch.order,
        type: 'PUBLIC',
        allowedRoles: null,
      } as any,
      update: { name: ch.name, order: ch.order, allowedRoles: null } as any,
    });
  }
}

/** 서버 기동 시: 디자인 요청 알림·시안 알림·종목 채널·종목 일반 채팅 보장 */
export async function bootstrapChatChannels(): Promise<void> {
  await ensureDesignNotificationChannels();
  await ensureDraftNotificationChannels();
  await ensureSportChatChannels();
  await ensureSportTeamChannels();
}
