-- 채널별 열람 가능 역할 (JSON 배열, null이면 제한 없음)
ALTER TABLE "chat_channels" ADD COLUMN IF NOT EXISTS "allowed_roles" JSONB;
