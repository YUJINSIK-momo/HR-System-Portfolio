-- Idempotent: may partially exist after db push / failed runs
DO $$ BEGIN
  CREATE TYPE "DesignRequestSport" AS ENUM ('SOCCER', 'BASKETBALL', 'BASEBALL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DesignRequestProduct" AS ENUM ('UNIFORM', 'ORIGINAL_SOCKS');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DesignRequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "design_requests" (
    "id" TEXT NOT NULL,
    "sport" "DesignRequestSport" NOT NULL,
    "team_name" TEXT NOT NULL,
    "product" "DesignRequestProduct" NOT NULL,
    "initial_request" TEXT NOT NULL,
    "detail" TEXT,
    "priority_first" BOOLEAN NOT NULL DEFAULT false,
    "status" "DesignRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requester_id" TEXT NOT NULL,
    "assignee_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "design_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "design_request_attachments" (
    "id" TEXT NOT NULL,
    "design_request_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "s3_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "design_request_attachments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "design_request_replies" (
    "id" TEXT NOT NULL,
    "design_request_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "design_request_replies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "design_requests_sport_created_at_idx" ON "design_requests"("sport", "created_at");
CREATE INDEX IF NOT EXISTS "design_requests_requester_id_idx" ON "design_requests"("requester_id");
CREATE INDEX IF NOT EXISTS "design_request_replies_design_request_id_created_at_idx" ON "design_request_replies"("design_request_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "design_requests" ADD CONSTRAINT "design_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "design_requests" ADD CONSTRAINT "design_requests_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "design_request_attachments" ADD CONSTRAINT "design_request_attachments_design_request_id_fkey" FOREIGN KEY ("design_request_id") REFERENCES "design_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "design_request_replies" ADD CONSTRAINT "design_request_replies_design_request_id_fkey" FOREIGN KEY ("design_request_id") REFERENCES "design_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "design_request_replies" ADD CONSTRAINT "design_request_replies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
