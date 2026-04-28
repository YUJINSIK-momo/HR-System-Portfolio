-- CreateEnum
CREATE TYPE "WorkLocation" AS ENUM ('OFFICE', 'OVERSEAS');

-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN     "work_location" "WorkLocation" NOT NULL DEFAULT 'OFFICE';
