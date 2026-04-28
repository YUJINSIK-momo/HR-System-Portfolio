-- AlterTable
ALTER TABLE "design_fixed_phrases" ADD COLUMN "sport" "DesignRequestSport" NOT NULL DEFAULT 'SOCCER';

ALTER TABLE "design_fixed_phrases" ALTER COLUMN "title" SET DEFAULT '';

-- DropIndex
DROP INDEX "design_fixed_phrases_lang_is_pinned_sort_order_idx";

-- CreateIndex
CREATE INDEX "design_fixed_phrases_lang_sport_is_pinned_sort_order_idx" ON "design_fixed_phrases"("lang", "sport", "is_pinned", "sort_order");
