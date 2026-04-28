-- CreateEnum
CREATE TYPE "AttendanceCorrectionKind" AS ENUM ('ADD_MISSING', 'EDIT_TIMES');

-- CreateTable
CREATE TABLE "attendance_correction_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "AttendanceCorrectionKind" NOT NULL,
    "work_date" DATE NOT NULL,
    "attendance_record_id" TEXT,
    "proposed_check_in" TIMESTAMP(3),
    "proposed_check_out" TIMESTAMP(3),
    "work_location" "WorkLocation" NOT NULL DEFAULT 'OFFICE',
    "reason" TEXT,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_correction_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_correction_requests_user_id_status_idx" ON "attendance_correction_requests"("user_id", "status");

-- CreateIndex
CREATE INDEX "attendance_correction_requests_status_created_at_idx" ON "attendance_correction_requests"("status", "created_at");

-- AddForeignKey
ALTER TABLE "attendance_correction_requests" ADD CONSTRAINT "attendance_correction_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendance_correction_requests" ADD CONSTRAINT "attendance_correction_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "attendance_correction_requests" ADD CONSTRAINT "attendance_correction_requests_attendance_record_id_fkey" FOREIGN KEY ("attendance_record_id") REFERENCES "attendance_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
