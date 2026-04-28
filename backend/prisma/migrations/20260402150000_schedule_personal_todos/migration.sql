-- CreateTable
CREATE TABLE "schedule_personal_todos" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_personal_todos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schedule_personal_todos_user_id_done_sort_order_idx" ON "schedule_personal_todos"("user_id", "done", "sort_order");

-- AddForeignKey
ALTER TABLE "schedule_personal_todos" ADD CONSTRAINT "schedule_personal_todos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
