import prisma from '../lib/prisma';
import { ONE_YEAR_MS } from '../constants/retention';
import { deleteS3Object } from './s3.service';

/** 1년 초과 디자인 요청·첨부(S3)·답변 첨부 삭제 (채팅 보존과 동일 기준) */
export async function runDesignRequestRetention(): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - ONE_YEAR_MS);

  const rows = await prisma.designRequest.findMany({
    where: { createdAt: { lt: cutoff } },
    select: {
      id: true,
      attachments: { select: { s3Key: true } },
      replies: {
        select: {
          attachments: { select: { s3Key: true } },
        },
      },
    },
  });

  for (const row of rows) {
    for (const a of row.attachments) {
      await deleteS3Object(a.s3Key);
    }
    for (const r of row.replies) {
      for (const a of r.attachments) {
        await deleteS3Object(a.s3Key);
      }
    }
  }

  const result = await prisma.designRequest.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return { deleted: result.count };
}
