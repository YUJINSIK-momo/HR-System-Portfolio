/**
 * 3년마다 (2029, 2032, 2035, ...) 1월 1일 기준으로
 * 3년 이전 데이터를 삭제하는 서비스
 */
import prisma from '../lib/prisma';

const RETENTION_START_YEAR = 2029;
const RETENTION_INTERVAL_YEARS = 3;

/** 해당 연도에 데이터 삭제를 실행할지 여부 */
export function shouldRunRetention(year: number): boolean {
  return year >= RETENTION_START_YEAR && (year - RETENTION_START_YEAR) % RETENTION_INTERVAL_YEARS === 0;
}

export interface RetentionResult {
  year: number;
  cutoffDate: Date;
  cutoffYear: number;
  deletedAttendance: number;
  deletedLeaveRequests: number;
  deletedLeaveBalances: number;
  deletedAttendanceCorrections: number;
}

/**
 * 3년 이전 데이터 삭제 실행
 * - attendance_records: date < (year-3)-01-01
 * - leave_requests: endDate < (year-3)-01-01
 * - leave_balances: year < (year-3)
 * - attendance_correction_requests: work_date < (year-3)-01-01
 */
export async function runDataRetention(year: number): Promise<RetentionResult> {
  const cutoffYear = year - 3;
  const cutoffDate = new Date(cutoffYear, 0, 1); // 1월 1일 00:00:00

  const [attendanceResult, leaveRequestsResult, leaveBalancesResult, correctionResult] = await Promise.all([
    prisma.attendanceRecord.deleteMany({ where: { date: { lt: cutoffDate } } }),
    prisma.leaveRequest.deleteMany({ where: { endDate: { lt: cutoffDate } } }),
    prisma.leaveBalance.deleteMany({ where: { year: { lt: cutoffYear } } }),
    prisma.attendanceCorrectionRequest.deleteMany({ where: { workDate: { lt: cutoffDate } } }),
  ]);

  return {
    year,
    cutoffDate,
    cutoffYear,
    deletedAttendance: attendanceResult.count,
    deletedLeaveRequests: leaveRequestsResult.count,
    deletedLeaveBalances: leaveBalancesResult.count,
    deletedAttendanceCorrections: correctionResult.count,
  };
}
