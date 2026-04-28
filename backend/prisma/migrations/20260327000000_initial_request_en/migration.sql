-- Korean guideline translation for freelancers: store English (was Japanese column)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'design_requests' AND column_name = 'initial_request_ja'
  ) THEN
    ALTER TABLE "design_requests" RENAME COLUMN "initial_request_ja" TO "initial_request_en";
  END IF;
END $$;
