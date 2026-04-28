-- CreateEnum
CREATE TYPE "DesignRequestReplyKind" AS ENUM ('COMMENT', 'DRAFT');

-- AlterTable design_requests
ALTER TABLE "design_requests" DROP COLUMN IF EXISTS "detail";
ALTER TABLE "design_requests" ADD COLUMN IF NOT EXISTS "initial_request_ja" TEXT;

-- AlterTable design_request_attachments
ALTER TABLE "design_request_attachments" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable design_request_replies
ALTER TABLE "design_request_replies" ADD COLUMN IF NOT EXISTS "kind" "DesignRequestReplyKind" NOT NULL DEFAULT 'COMMENT';
ALTER TABLE "design_request_replies" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "design_request_reply_attachments" (
    "id" TEXT NOT NULL,
    "reply_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "s3_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "design_request_reply_attachments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "design_request_reply_attachments" ADD CONSTRAINT "design_request_reply_attachments_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "design_request_replies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
