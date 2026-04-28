-- CreateEnum
CREATE TYPE "FamilyLeaveSubType" AS ENUM ('OWN_MARRIAGE', 'CHILD_MARRIAGE', 'SPOUSE_CHILDBIRTH', 'PARENT_DEATH', 'GRANDPARENT_DEATH', 'SIBLING_DEATH');

-- AlterTable
ALTER TABLE "leave_requests" ADD COLUMN "family_sub_type" "FamilyLeaveSubType";
