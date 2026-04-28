-- AlterTable
ALTER TABLE "chat_attachments" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- 기존 행: 메시지별 생성 시각 순으로 순서 부여
UPDATE "chat_attachments" AS ca
SET "sort_order" = sub.rn
FROM (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY message_id ORDER BY created_at ASC) - 1)::int AS rn
  FROM "chat_attachments"
) AS sub
WHERE ca.id = sub.id;

-- CreateIndex
CREATE INDEX "chat_attachments_message_id_sort_order_idx" ON "chat_attachments"("message_id", "sort_order");
