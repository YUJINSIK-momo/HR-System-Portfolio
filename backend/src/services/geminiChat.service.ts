import { GoogleGenerativeAI } from '@google/generative-ai';

/** 대화용 — 번역과 동일 기본 모델. `GEMINI_CHAT_MODEL`로만 덮어쓰기 */
const CHAT_MODEL = (process.env.GEMINI_CHAT_MODEL || 'gemini-3.1-flash-lite-preview').trim();

const DEFAULT_SYSTEM = `You are a helpful AI assistant for workplace use. Give clear, accurate answers. Match the user's language (Korean, Japanese, or English) unless they ask otherwise. Be concise when the question is simple.`;

export type GeminiChatMessage = { role: 'user' | 'assistant'; content: string };

export type GeminiChatResult = {
  reply: string;
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
};

function validateAlternating(messages: GeminiChatMessage[]): void {
  if (messages.length === 0) {
    throw new Error('메시지가 비어 있습니다.');
  }
  const last = messages[messages.length - 1];
  if (last.role !== 'user') {
    throw new Error('마지막 메시지는 사용자 질문이어야 합니다.');
  }
  for (let i = 0; i < messages.length; i++) {
    const expected = i % 2 === 0 ? 'user' : 'assistant';
    if (messages[i].role !== expected) {
      throw new Error('대화 순서가 올바르지 않습니다. (사용자 → 어시스턴트 → … 순으로 번갈아야 합니다.)');
    }
  }
}

/**
 * Gemini 채팅 (마지막 메시지는 사용자 질문, 이전은 user/assistant 번갈아야 함)
 */
export async function runGeminiChat(
  messages: GeminiChatMessage[],
  systemInstructionOverride?: string
): Promise<GeminiChatResult> {
  validateAlternating(messages);

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const systemInstruction = (systemInstructionOverride || process.env.GEMINI_CHAT_SYSTEM || DEFAULT_SYSTEM).trim();

  const model = genAI.getGenerativeModel({
    model: CHAT_MODEL,
    systemInstruction,
  });

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === 'user' ? ('user' as const) : ('model' as const),
    parts: [{ text: m.content }],
  }));

  const lastUser = messages[messages.length - 1].content;

  const chat = model.startChat({ history });
  let result;
  try {
    result = await chat.sendMessage(lastUser);
  } catch (e: unknown) {
    const detail =
      (e as Error)?.message || (e as { message?: string })?.message || String(e);
    console.error('[GeminiChat] API error:', detail);
    throw new Error(detail);
  }

  const response = result.response;
  const candidate = response.candidates?.[0];
  const part = candidate?.content?.parts?.[0];
  const reply =
    part && 'text' in part ? String(part.text) : '';
  const trimmed = reply.trim();

  const usage = response.usageMetadata;
  return {
    reply: trimmed || '(응답 없음)',
    promptTokenCount: usage?.promptTokenCount,
    candidatesTokenCount: usage?.candidatesTokenCount,
    totalTokenCount: usage?.totalTokenCount,
  };
}
