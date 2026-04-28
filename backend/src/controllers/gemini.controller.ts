import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { runGeminiChat } from '../services/geminiChat.service';

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(48000),
});

const chatBodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(80),
});

export async function postGeminiChat(req: AuthRequest, res: Response): Promise<void> {
  const parsed = chatBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: '잘못된 요청입니다.', errors: parsed.error.flatten() });
    return;
  }

  try {
    const result = await runGeminiChat(parsed.data.messages);
    res.json({
      reply: result.reply,
      promptTokenCount: result.promptTokenCount,
      candidatesTokenCount: result.candidatesTokenCount,
      totalTokenCount: result.totalTokenCount,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[GeminiChat] controller:', msg);
    res.status(500).json({ message: msg || 'Gemini 요청에 실패했습니다.' });
  }
}
