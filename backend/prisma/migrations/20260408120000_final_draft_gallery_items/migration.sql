-- CreateTable
CREATE TABLE "final_draft_gallery_items" (
    "id" TEXT NOT NULL,
    "sport" "DesignRequestSport" NOT NULL,
    "s3_key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "source_design_request_id" TEXT,
    "source_reply_attachment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "final_draft_gallery_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "final_draft_gallery_items_sport_created_at_idx" ON "final_draft_gallery_items"("sport", "created_at");

-- AddForeignKey
ALTER TABLE "final_draft_gallery_items" ADD CONSTRAINT "final_draft_gallery_items_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
