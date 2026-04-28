import { Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import { AuthRequest } from '../middleware/auth';

const DATA_DIR = path.join(__dirname, '../../data');
const IMAGE_MODEL = (process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview').trim();
const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

function isLightColor(hex: string): boolean {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 180;
}

const STYLE_REFERENCE_B64: string | null = (() => {
  try {
    return fs.readFileSync(path.join(DATA_DIR, 'Pixelation.png')).toString('base64');
  } catch {
    console.warn('[LogoPixel] Pixelation.png 레퍼런스 로드 실패');
    return null;
  }
})();

const SYSTEM_INSTRUCTION = `
You are a pixel art converter specialized in logo pixelation.
OUTPUT EXACTLY ONE IMAGE (PNG). Never respond with text only; always generate the image.

You will receive:
1) LOGO IMAGE (first image): the source logo to convert into pixel art.
2) STYLE REFERENCE (second image): reference for pixel GRID DENSITY and pixel BLOCK SIZE only — do NOT copy its background texture or fabric feel.

Your task:
- Analyze the logo silhouette and design areas (ignore the logo's original background).
- Convert the logo into a clean square-pixel grid art.
- Use ONLY the single color specified in the prompt for ALL active (logo) pixels.
- BACKGROUND: must be a completely flat, solid, uniform fill — zero texture, zero grain, zero fabric feel, zero noise. Pure flat color only.
- Do NOT apply any texture, pattern, weave, knit, noise, or material effect to the background under any circumstances.
- Output should look like clean 2D pixel art on a perfectly solid background.
`.trim();

function pickFirstInlineImage(result: {
  response: {
    candidates?: Array<{
      finishReason?: string;
      content?: { parts?: Array<{ inlineData?: { data: string; mimeType?: string } }> };
    }>;
    promptFeedback?: { blockReason?: string };
  };
}): { imageData?: string; mimeType?: string; diagnostic: string } {
  const candidates = result.response.candidates ?? [];
  const finish: string[] = [];
  for (const c of candidates) {
    finish.push(String(c.finishReason ?? 'UNKNOWN'));
    for (const p of c.content?.parts ?? []) {
      if (p && 'inlineData' in p && p.inlineData?.data) {
        return { imageData: p.inlineData.data, mimeType: p.inlineData.mimeType ?? 'image/png', diagnostic: '' };
      }
    }
  }
  const block = result.response.promptFeedback?.blockReason;
  const diag = [
    `candidates=${candidates.length}`,
    finish.length ? `finish=${finish.join(';')}` : '',
    block ? `promptBlock=${String(block)}` : '',
  ].filter(Boolean).join(' · ');
  return { diagnostic: diag || 'no_image' };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function generatePixelArtOnce(
  genAI: GoogleGenerativeAI,
  imageBase64: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
  colorHex: string
): Promise<{ imageData?: string; mimeType?: string; error?: string }> {
  const hasRef = !!STYLE_REFERENCE_B64;
  const bgColor = isLightColor(colorHex) ? '#000000 (black)' : '#FFFFFF (white)';

  const prompt = `Convert the provided logo into pixel art using ONLY the color ${colorHex} for all active pixels.

STRICT RULES — follow exactly:
1. Active pixels (logo areas): filled with ${colorHex}. No gradients, no shading, no anti-aliasing.
2. Background: solid flat ${bgColor}. This means:
   - NO texture of any kind
   - NO fabric, knit, weave, or material effect
   - NO noise or grain
   - Just a perfectly uniform flat color fill: ${bgColor}
3. Pixel style: use the STYLE REFERENCE only to match grid cell size and density. Do NOT copy its background appearance.
4. Preserve the logo shape clearly.
5. Output one PNG image only.

Generate the pixel art image now.`;

  const model = genAI.getGenerativeModel({
    model: IMAGE_MODEL,
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      // @ts-expect-error responseModalities not yet in SDK types
      responseModalities: ['IMAGE', 'TEXT'],
    },
  });

  const parts: Parameters<typeof model.generateContent>[0] = [
    prompt,
    { inlineData: { mimeType, data: imageBase64 } },
    ...(hasRef ? [{ inlineData: { mimeType: 'image/png' as const, data: STYLE_REFERENCE_B64! } }] : []),
  ];

  const result = await model.generateContent(parts);
  const picked = pickFirstInlineImage(result);

  if (picked.imageData) {
    return { imageData: picked.imageData, mimeType: picked.mimeType ?? 'image/png' };
  }
  return { error: `이미지를 받지 못했습니다${picked.diagnostic ? ` (${picked.diagnostic})` : ''}` };
}

async function generatePixelArt(
  genAI: GoogleGenerativeAI,
  imageBase64: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
  colorHex: string
): Promise<{ imageData?: string; mimeType?: string; error?: string }> {
  const MAX_ATTEMPTS = 3;
  let last: { imageData?: string; mimeType?: string; error?: string } = { error: '이미지를 받지 못했습니다' };

  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    last = await generatePixelArtOnce(genAI, imageBase64, mimeType, colorHex);
    if (last.imageData) {
      if (i > 1) console.warn(`[LogoPixel] attempt ${i} 성공`);
      return last;
    }
    console.warn(`[LogoPixel] attempt ${i}/${MAX_ATTEMPTS} 실패:`, last.error);
    if (i < MAX_ATTEMPTS) await sleep(400 * i);
  }

  return last;
}

export async function postLogoPixelGenerate(req: AuthRequest, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ message: '이미지 파일이 필요합니다.' });
    return;
  }

  const rawColor = typeof req.body.color === 'string' ? req.body.color.trim() : '';
  if (!HEX_COLOR_RE.test(rawColor)) {
    res.status(400).json({ message: '올바른 컬러를 선택해 주세요.' });
    return;
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    res.status(500).json({ message: 'GEMINI_API_KEY가 설정되지 않았습니다.' });
    return;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const imageBase64 = file.buffer.toString('base64');
    const mimeType = file.mimetype as 'image/jpeg' | 'image/png' | 'image/webp';

    const result = await generatePixelArt(genAI, imageBase64, mimeType, rawColor);

    if (result.imageData) {
      res.json({ imageData: result.imageData, mimeType: result.mimeType ?? 'image/png' });
    } else {
      res.status(500).json({ message: result.error ?? '변환에 실패했습니다.' });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[LogoPixel]', msg);
    res.status(500).json({ message: msg });
  }
}
