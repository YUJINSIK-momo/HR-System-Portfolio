import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import type { MulterError } from 'multer';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import attendanceRouter from './routes/attendance';
import attendanceCorrectionRouter from './routes/attendanceCorrection';
import leaveRouter from './routes/leave';
import holidaysRouter from './routes/holidays';
import announcementsRouter from './routes/announcements';
import calendarRouter from './routes/calendar';
import scheduleRouter from './routes/schedule';
import chatRouter from './routes/chat';
import designRequestsRouter from './routes/designRequests';
import adminTranslationRouter from './routes/adminTranslation';
import geminiRouter from './routes/gemini';
import nanoRouter from './routes/nano';
import logoPixelRouter from './routes/logo-pixel';
import designRequestBkRouter from './routes/designRequestBk';
import designFixedPhrasesRouter from './routes/designFixedPhrases';
import adminDesignFixedPhrasesRouter from './routes/adminDesignFixedPhrases';

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Sport', 'X-Filename'],
  })
);
app.use(express.json({ limit: '30mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/attendance', attendanceRouter);
app.use('/attendance-corrections', attendanceCorrectionRouter);
app.use('/leave', leaveRouter);
app.use('/holidays', holidaysRouter);
app.use('/announcements', announcementsRouter);
app.use('/calendar', calendarRouter);
app.use('/schedule', scheduleRouter);
app.use('/chat', chatRouter);
app.use('/design-requests', designRequestsRouter);
app.use('/admin/translation', adminTranslationRouter);
app.use('/gemini', geminiRouter);
app.use('/nano', nanoRouter);
app.use('/logo-pixel', logoPixelRouter);
app.use('/admin/design-request-bk', designRequestBkRouter);
app.use('/design-fixed-phrases', designFixedPhrasesRouter);
app.use('/admin/design-fixed-phrases', adminDesignFixedPhrasesRouter);

/** async 라우트에서 던진 오류를 JSON으로 반환 (Express 4 기본은 미처리 시 빈 500) */
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (res.headersSent) return;
  console.error('[express]', err);

  const multerErr = err as Partial<MulterError>;
  if (multerErr.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({
      message: '업로드 이미지가 너무 큽니다. 3MB 이하로 줄이거나 해상도를 낮춰 주세요.',
    });
    return;
  }

  const dev = process.env.NODE_ENV !== 'production';
  const msg = err instanceof Error ? err.message : String(err);
  res.status(500).json({
    message: dev ? msg : '서버 오류가 발생했습니다.',
  });
});

export default app;
