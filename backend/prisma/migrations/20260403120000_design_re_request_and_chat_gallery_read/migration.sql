-- 디자인 답변 종류: CS 재요청
DO $$ BEGIN
  ALTER TYPE "DesignRequestReplyKind" ADD VALUE 'RE_REQUEST';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 채널 읽음: 채팅(요청) / 갤러리(재요청 첨부) 탭 분리
ALTER TABLE "chat_channel_reads" ADD COLUMN IF NOT EXISTS "last_read_gallery_at" TIMESTAMP(3);
UPDATE "chat_channel_reads" SET "last_read_gallery_at" = "last_read_at" WHERE "last_read_gallery_at" IS NULL;
