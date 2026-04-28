-- AlterTable
ALTER TABLE "announcements" ADD COLUMN     "image_s3_key" TEXT,
ADD COLUMN     "is_pinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pinned_at" TIMESTAMP(3);
