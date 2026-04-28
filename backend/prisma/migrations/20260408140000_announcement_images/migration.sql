-- CreateTable
CREATE TABLE "announcement_images" (
    "id" TEXT NOT NULL,
    "announcement_id" TEXT NOT NULL,
    "s3_key" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_images_pkey" PRIMARY KEY ("id")
);

-- Migrate legacy single image per announcement
INSERT INTO "announcement_images" ("id", "announcement_id", "s3_key", "sort_order", "created_at")
SELECT gen_random_uuid()::text, "id", "image_s3_key", 0, CURRENT_TIMESTAMP
FROM "announcements"
WHERE "image_s3_key" IS NOT NULL;

-- CreateIndex
CREATE INDEX "announcement_images_announcement_id_sort_order_idx" ON "announcement_images"("announcement_id", "sort_order");

-- AddForeignKey
ALTER TABLE "announcement_images" ADD CONSTRAINT "announcement_images_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "announcements" DROP COLUMN "image_s3_key";
