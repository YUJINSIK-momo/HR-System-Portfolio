-- LeaveType enum: OTHER 제거, OFFICIAL·FAMILY 추가
-- PostgreSQL은 enum value 직접 삭제 불가 → 새 enum 생성 후 교체

-- 1. 새 enum 생성
CREATE TYPE "LeaveType_new" AS ENUM ('ANNUAL', 'HALF_DAY_AM', 'HALF_DAY_PM', 'QUARTER_DAY', 'SICK', 'OFFICIAL', 'FAMILY');

-- 2. 기존 OTHER 데이터를 SICK으로 매핑 후 컬럼 교체
ALTER TABLE "leave_requests" 
  ALTER COLUMN "type" DROP DEFAULT,
  ALTER COLUMN "type" TYPE "LeaveType_new" 
  USING (
    CASE "type"::text 
    WHEN 'OTHER' THEN 'SICK'::"LeaveType_new" 
    ELSE "type"::text::"LeaveType_new" 
    END
  );

-- 3. 기존 enum 삭제 후 새 enum으로 대체
DROP TYPE "LeaveType";
ALTER TYPE "LeaveType_new" RENAME TO "LeaveType";

-- 4. default 복원 (필요 시)
ALTER TABLE "leave_requests" 
  ALTER COLUMN "type" SET DEFAULT 'ANNUAL'::"LeaveType";
