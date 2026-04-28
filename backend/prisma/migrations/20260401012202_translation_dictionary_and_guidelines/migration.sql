-- CreateTable
CREATE TABLE "translation_dictionary_entries" (
    "id" TEXT NOT NULL,
    "lang_pair" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "src" JSONB NOT NULL,
    "tgt" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "translation_dictionary_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translation_guidelines" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "translation_guidelines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "translation_dictionary_entries_lang_pair_category_idx" ON "translation_dictionary_entries"("lang_pair", "category");

-- CreateIndex
CREATE UNIQUE INDEX "translation_guidelines_name_key" ON "translation_guidelines"("name");
