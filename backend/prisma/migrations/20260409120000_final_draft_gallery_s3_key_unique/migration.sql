-- 동일 s3_key로 여러 행이 있으면 최신 created_at 한 건만 남김
DELETE FROM "final_draft_gallery_items"
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (PARTITION BY s3_key ORDER BY created_at DESC) AS rn
    FROM "final_draft_gallery_items"
  ) t
  WHERE t.rn > 1
);

-- CreateIndex
CREATE UNIQUE INDEX "final_draft_gallery_items_s3_key_key" ON "final_draft_gallery_items"("s3_key");
