-- CreateTable
CREATE TABLE "chat_channel_reads" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "last_read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_channel_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_channel_reads_user_id_channel_id_key" ON "chat_channel_reads"("user_id", "channel_id");

-- AddForeignKey
ALTER TABLE "chat_channel_reads" ADD CONSTRAINT "chat_channel_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_channel_reads" ADD CONSTRAINT "chat_channel_reads_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "chat_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
