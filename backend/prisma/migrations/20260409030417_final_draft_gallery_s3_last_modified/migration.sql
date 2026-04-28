-- DropIndex
DROP INDEX "final_draft_gallery_items_sport_created_at_idx";

-- AlterTable
ALTER TABLE "final_draft_gallery_items" ADD COLUMN     "s3_last_modified" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 기존 행: DB 등록일과 동일하게 맞춤 (이후 업로드·동기화는 S3 기준으로 갱신)
UPDATE "final_draft_gallery_items" SET "s3_last_modified" = "created_at";

-- CreateIndex
CREATE INDEX "final_draft_gallery_items_sport_s3_last_modified_idx" ON "final_draft_gallery_items"("sport", "s3_last_modified");
