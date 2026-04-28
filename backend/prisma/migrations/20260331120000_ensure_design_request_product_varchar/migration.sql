-- product 컬럼이 아직 DesignRequestProduct enum이면 VARCHAR(200)으로 전환 (미적용/실패 DB 보정)
-- Prisma 스키마는 이미 String이므로, DB만 맞추면 일본어 상품명 저장 가능
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_type t ON t.oid = a.atttypid
    WHERE n.nspname = 'public'
      AND c.relname = 'design_requests'
      AND a.attname = 'product'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND t.typtype = 'e'
      AND lower(t.typname) = 'designrequestproduct'
  ) THEN
    ALTER TABLE "design_requests" ALTER COLUMN "product" DROP DEFAULT;
    ALTER TABLE "design_requests" ALTER COLUMN "product" TYPE TEXT USING "product"::text;
    UPDATE "design_requests" SET "product" = 'ユニフォーム' WHERE "product" = 'UNIFORM';
    UPDATE "design_requests" SET "product" = 'オリジナルソックス' WHERE "product" = 'ORIGINAL_SOCKS';
    DROP TYPE IF EXISTS "DesignRequestProduct";
    ALTER TABLE "design_requests" ALTER COLUMN "product" SET NOT NULL;
    ALTER TABLE "design_requests" ALTER COLUMN "product" TYPE VARCHAR(200);
  END IF;
END $$;
