import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  ensureTranslationCache,
  getDictionaryLinesForTranslation,
  getGuidelineTexts,
} from './translationData.service';

const TRANSLATION_MODEL = 'gemini-3.1-flash-lite-preview';

/** guideline 이름 = translation/guideline/{name}.md (DB·시드와 동일) */
const LANG_MAP = {
  'ko-en': { from: 'Korean', to: 'English', guideline: ['base', 'ko2en'] },
  'ko-ja': { from: 'Korean', to: 'Japanese', guideline: ['base', 'ko2ja'] },
  'ja-en': { from: 'Japanese', to: 'English', guideline: ['base', 'jp2en'] },
  'ja-ko': { from: 'Japanese', to: 'Korean', guideline: ['base', 'jp2ko'] },
  'en-ko': { from: 'English', to: 'Korean', guideline: ['base', 'en2ko'] },
  'en-ja': { from: 'English', to: 'Japanese', guideline: ['base', 'en2ja'] },
} as const;

export type TranslationMode = keyof typeof LANG_MAP;

const DICT_PROMPT_MAX_LINES = 500;

/** 시스템: 방향·가이드·고정 용어·출력 제한 (번역할 본문은 user 메시지로만 전달) */
function buildSystemInstruction(
  from: string,
  to: string,
  guidelineNames: string[],
  fromLang: string,
  toLang: string
): string {
  const guidelineText = getGuidelineTexts(guidelineNames);
  const dict = getDictionaryLinesForTranslation(fromLang, toLang);
  const shown = dict.slice(0, DICT_PROMPT_MAX_LINES);
  const more =
    dict.length > DICT_PROMPT_MAX_LINES ? `\n...(and ${dict.length - DICT_PROMPT_MAX_LINES} more entries)` : '';

  return `You are a translator for production use. Reply with ONLY the translated text—no preamble, no explanation, no labels, no markdown code fences unless the source text itself requires them.

Translation direction: ${from} → ${to}.

Guidelines:
${guidelineText || '(No guideline text loaded.)'}

Fixed terms when applicable (source → target):
${shown.join('\n')}${more}

Output rule: single block of translated text only.`;
}

export async function translate(text: string, fromLang: string, toLang: string): Promise<string> {
  const key = `${fromLang}-${toLang}` as TranslationMode;
  const cfg = LANG_MAP[key];
  if (!cfg) {
    throw new Error(`Unsupported translation: ${fromLang} → ${toLang}`);
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  await ensureTranslationCache();

  const genAI = new GoogleGenerativeAI(apiKey);
  const systemInstruction = buildSystemInstruction(cfg.from, cfg.to, [...cfg.guideline], fromLang, toLang);
  const model = genAI.getGenerativeModel({
    model: TRANSLATION_MODEL,
    systemInstruction,
  });

  const userMessage = `Translate the following text from ${cfg.from} to ${cfg.to}:\n\n${text}`;

  let result;
  try {
    result = await model.generateContent(userMessage);
  } catch (apiErr: unknown) {
    const detail =
      (apiErr as Error)?.message ||
      (apiErr as { message?: string })?.message ||
      String(apiErr);
    console.error('[Translation] Gemini API error:', detail);
    throw new Error(detail);
  }
  const response = result.response;
  const candidate = response.candidates?.[0];
  const part = candidate?.content?.parts?.[0];
  const translated = part && 'text' in part ? String(part.text).trim() : text;
  return translated;
}
