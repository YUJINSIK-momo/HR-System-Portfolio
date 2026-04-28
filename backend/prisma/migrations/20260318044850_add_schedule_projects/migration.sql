-- AlterTable
ALTER TABLE "schedule_tasks" ADD COLUMN     "end_date" DATE,
ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "project_id" TEXT,
ADD COLUMN     "start_date" DATE;

-- CreateTable
CREATE TABLE "schedule_projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "year" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_projects_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "schedule_tasks" ADD CONSTRAINT "schedule_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "schedule_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
