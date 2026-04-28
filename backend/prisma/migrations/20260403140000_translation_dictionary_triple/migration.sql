-- 고정 딕셔너리: 언어 쌍(src/tgt/lang_pair) → 한 행에 ko_json, en_text, ja_text

-- 1) 새 컬럼
ALTER TABLE "translation_dictionary_entries" ADD COLUMN IF NOT EXISTS "ko_json" JSONB;
ALTER TABLE "translation_dictionary_entries" ADD COLUMN IF NOT EXISTS "en_text" TEXT;
ALTER TABLE "translation_dictionary_entries" ADD COLUMN IF NOT EXISTS "ja_text" TEXT DEFAULT '';

-- 2) ko-en 행 → ko, en
UPDATE "translation_dictionary_entries"
SET
  "ko_json" = "src",
  "en_text" = "tgt",
  "ja_text" = ''
WHERE "lang_pair" = 'ko-en';

-- 3) ko-ja 행의 번역을 동일 src·category인 ko-en 행에 병합
UPDATE "translation_dictionary_entries" AS e
SET "ja_text" = COALESCE(NULLIF(TRIM(j."tgt"), ''), e."ja_text")
FROM "translation_dictionary_entries" AS j
WHERE e."lang_pair" = 'ko-en'
  AND j."lang_pair" = 'ko-ja'
  AND e."category" = j."category"
  AND e."src" = j."src";

-- 4) ko-en만 유지 (다른 lang_pair 행 삭제)
DELETE FROM "translation_dictionary_entries" WHERE "lang_pair" <> 'ko-en';

-- 5) 기존 컬럼·인덱스 제거
DROP INDEX IF EXISTS "translation_dictionary_entries_lang_pair_category_idx";
ALTER TABLE "translation_dictionary_entries" DROP COLUMN IF EXISTS "lang_pair";
ALTER TABLE "translation_dictionary_entries" DROP COLUMN IF EXISTS "src";
ALTER TABLE "translation_dictionary_entries" DROP COLUMN IF EXISTS "tgt";

-- 6) NOT NULL
ALTER TABLE "translation_dictionary_entries" ALTER COLUMN "ko_json" SET NOT NULL;
ALTER TABLE "translation_dictionary_entries" ALTER COLUMN "en_text" SET NOT NULL;
ALTER TABLE "translation_dictionary_entries" ALTER COLUMN "ja_text" SET NOT NULL;
ALTER TABLE "translation_dictionary_entries" ALTER COLUMN "ja_text" SET DEFAULT '';

CREATE INDEX IF NOT EXISTS "translation_dictionary_entries_category_idx" ON "translation_dictionary_entries"("category");
