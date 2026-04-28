-- Prisma maps initialRequestEn -> initial_request_en. Some DBs may lack this column
-- if an older migration chain was skipped (e.g. only design_requests v1 applied).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'design_requests' AND column_name = 'initial_request_ja'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'design_requests' AND column_name = 'initial_request_en'
  ) THEN
    ALTER TABLE "design_requests" RENAME COLUMN "initial_request_ja" TO "initial_request_en";
  END IF;
END $$;

ALTER TABLE "design_requests" ADD COLUMN IF NOT EXISTS "initial_request_en" TEXT;
