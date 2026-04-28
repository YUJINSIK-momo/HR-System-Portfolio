-- AlterEnum → Text: 상품을 종목별 일본어 문자열로 저장
ALTER TABLE "design_requests" ALTER COLUMN "product" DROP DEFAULT;
ALTER TABLE "design_requests" ALTER COLUMN "product" TYPE TEXT USING "product"::text;

UPDATE "design_requests" SET "product" = 'ユニフォーム' WHERE "product" = 'UNIFORM';
UPDATE "design_requests" SET "product" = 'オリジナルソックス' WHERE "product" = 'ORIGINAL_SOCKS';

DROP TYPE IF EXISTS "DesignRequestProduct";

-- 길이 제한 (Prisma @db.VarChar(200))
ALTER TABLE "design_requests" ALTER COLUMN "product" SET NOT NULL;
ALTER TABLE "design_requests" ALTER COLUMN "product" TYPE VARCHAR(200);
