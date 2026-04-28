-- CreateEnum
CREATE TYPE "DesignFixedPhraseLang" AS ENUM ('KO', 'JA');

-- CreateTable
CREATE TABLE "design_fixed_phrases" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "message" TEXT NOT NULL,
    "lang" "DesignFixedPhraseLang" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "design_fixed_phrases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "design_fixed_phrases_lang_is_pinned_sort_order_idx" ON "design_fixed_phrases"("lang", "is_pinned", "sort_order");
