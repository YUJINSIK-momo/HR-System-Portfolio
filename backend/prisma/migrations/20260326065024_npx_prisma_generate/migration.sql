-- AlterTable
ALTER TABLE "chat_messages" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "design_request_replies" ALTER COLUMN "content" SET DEFAULT '',
ALTER COLUMN "updated_at" DROP DEFAULT;
