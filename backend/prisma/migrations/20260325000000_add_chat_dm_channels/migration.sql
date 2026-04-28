-- Idempotent: enum/table may already exist (e.g. partial apply or db push)
DO $$ BEGIN
  CREATE TYPE "ChatChannelType" AS ENUM ('PUBLIC', 'DM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "chat_channels" ADD COLUMN IF NOT EXISTS "type" "ChatChannelType" NOT NULL DEFAULT 'PUBLIC';
ALTER TABLE "chat_channels" ADD COLUMN IF NOT EXISTS "participant_ids" JSONB;
