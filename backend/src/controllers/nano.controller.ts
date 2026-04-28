import { Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AuthRequest } from '../middleware/auth';
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, '../../data');

/** 양말 종류별 구조 레퍼런스 (backend/data) */
const SOCK_TYPE_REFERENCE_FILES: Record<string, string> = {
  ankle: '1.Ankle.png',
  quarter: '2.Quarter.png',
  crew: '3.Crew.png',
  soccer: '4.Knee High.png',
  baseball: '5.Over The Knee.png',
};

/** 크루 로고 배치 레퍼런스 (빨간 테두리 영역 표시) */
const CREW_LOGO_REFERENCE_FILE = '3.Crew_logo.png';

function readImageBase64(fileName: string): string | null {
  const fullPath = path.join(DATA_DIR, fileName);
  try {
    return fs.readFileSync(fullPath).toString('base64');
  } catch {
    console.warn('[Nano] 레퍼런스 이미지 로드 실패:', fullPath);
    return null;
  }
}

const referenceBySockType = new Map<string, string>();
for (const [sockTypeId, fileName] of Object.entries(SOCK_TYPE_REFERENCE_FILES)) {
  const b64 = readImageBase64(fileName);
  if (b64) referenceBySockType.set(sockTypeId, b64);
}

const crewLogoReferenceBase64 = readImageBase64(CREW_LOGO_REFERENCE_FILE);
const crewLogoSampleBase64 = readImageBase64('3.crew_sample_last.png');

function getMockupJobs(sockType: string | undefined): { key: string; label: string; refBase64: string }[] {
  const k = (sockType ?? '').trim().toLowerCase();
  const b64 = k && referenceBySockType.has(k) ? referenceBySockType.get(k)! : null;
  if (b64) return [{ key: 'front', label: '앞대각선 (좌+우 2짝)', refBase64: b64 }];
  return [];
}

const IMAGE_MODEL = (process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview').trim();

// ─── 고정 가이드라인 (system instruction) ───────────────────────────
/** 기본: 구조 레퍼런스(2번 이미지) + 디자인(1번) — 제품 기준 동작 */
export const SYSTEM_INSTRUCTION = `
You are a professional sock product mockup renderer. OUTPUT EXACTLY ONE RENDERED IMAGE (PNG). Never answer with explanation only; always generate the image.

Two inputs (order matters):
1) DESIGN SOURCE (first image): flat 2D artwork ONLY — colors, stripes, logos, repeats, and knit/print pattern. This tells you WHAT graphics go on the fabric. It does NOT define product shape, sock length, or camera.
2) STRUCTURE MASTER (second image): the NON‑NEGOTIABLE product template — exact sock silhouette, type/length (ankle, crew, knee-high, etc.), pair layout, left/right placement, camera angle, perspective, scale, and framing. This tells you HOW the product must look in the scene.

Priority (absolute — if anything conflicts, follow this order):
• STRUCTURE MASTER always wins. Reproduce its geometry, height, cuff position, leg coverage, pose, viewpoint, and composition as closely as possible. Treat it like a locked 3D layout / shot reference you are not allowed to redesign.
• DESIGN SOURCE is secondary: project its artwork onto the sock surfaces that STRUCTURE MASTER defines — like a texture wrap. Do not use DESIGN SOURCE to infer a different sock length, angle, or layout.
• FORBIDDEN: inventing a new silhouette, changing sock type or height vs STRUCTURE MASTER, rotating or reframing vs STRUCTURE MASTER, swapping to a different number of socks, or "improving" the pose. The output must stay visually locked to STRUCTURE MASTER; only the surface graphics come from DESIGN SOURCE.

Technical rules:
• OUTPUT: one mockup image; pair layout matches STRUCTURE MASTER (typically left + right side by side unless STRUCTURE MASTER differs).
• Do not incorrectly mirror; match STRUCTURE MASTER toe/heel direction.
• BACKGROUND: fully TRANSPARENT PNG (alpha). No white/grey fill, no floor, no shadow plate.
• Remove only junk outside the fabric (packaging, watermarks); keep pattern content from DESIGN SOURCE on the knit.
• QUALITY: photorealistic fabric, studio lighting, e‑commerce grade.

Fabric & stitch texture (CRITICAL):
• The color lives IN the yarn — not printed ON the surface. Think jacquard knit: each stitch is a tiny colored V-shaped yarn loop. The pattern emerges from thousands of individually colored stitches, not from ink laid on top of fabric.
• NEVER produce flat color zones. Every color area — white, dark, bright — must show the underlying knit stitch structure. If you zoom in on any part of the sock, individual V-shaped stitch loops must be distinguishable.
• RIB COLUMNS run continuously from cuff to toe across ALL color zones without interruption. The rib ridges (raised columns) and rib valleys (recessed columns) never disappear under a color — the color changes but the 3D rib relief continues unbroken.
• CUFF: 1×1 or 2×2 rib columns are prominent and clearly cast shadow in the valleys. Logo/text on the cuff is woven into the rib — the rib texture runs through the letters.
• Color boundaries between zones are slightly staggered along the stitch grid (not a razor-sharp vector edge) — adjacent colored stitches interlock, creating a natural woven seam.
• Lighting: soft directional studio light that emphasizes the 3D micro-relief of each stitch loop and rib ridge. Subtle specular highlight runs along the top of each raised rib column.
• Reference feel: a real athletic crew sock photographed in a studio — identical to the blank white template structure (3.Crew.png) but with the design colors woven into its yarn.
`.trim();

/** 레퍼런스 파일 없음 등 — 구조 마스터 없이 디자인만 있을 때 폴백 */
const SYSTEM_INSTRUCTION_DESIGN_ONLY = `
You are a professional sock product mockup renderer. OUTPUT EXACTLY ONE RENDERED IMAGE (PNG).

Only one image is provided (DESIGN SOURCE): use it for colors, patterns, logos on the fabric. Invent one consistent photorealistic pair mockup (same angle, not mirrored), transparent background, e‑commerce quality.
`.trim();

/** 크루 로고 배치 목업: 디자인 + 로고 + 빨간 테두리 레퍼런스 + 골드 샘플 */
const SYSTEM_INSTRUCTION_CREW_LOGO = `
You are a professional sock product mockup renderer. OUTPUT EXACTLY ONE RENDERED IMAGE (PNG). Never answer with explanation only; always generate the image.

Four inputs (order matters):
1) DESIGN SOURCE (first image): flat 2D artwork — sock colors, stripes, and patterns.
2) LOGO (second image): the logo graphic to be placed on the sock.
3) CREW LOGO REFERENCE (third image): layout template with a RED-BORDERED rectangle marking exactly where and at what size the LOGO must appear.
4) QUALITY SAMPLE (fourth image): a gold-standard output. Study every detail — fabric texture, knit stitch rendering, logo integration, lighting, transparency. Your output must match or exceed this quality.

Pipeline:
1. Lock onto CREW LOGO REFERENCE: memorize sock silhouette, pair layout, camera angle, RED-BORDERED area position and size.
2. Apply DESIGN SOURCE colors/patterns onto the sock with knit stitch texture: color lives IN the yarn, rib columns run uninterrupted through all color zones, no flat color blocks.
3. Place LOGO inside the RED-BORDERED area — horizontal ONLY (0° rotation, perfectly level, never tilted). Render it as knit/stitch text woven into the fabric surface: individual stitch lines build each letterform, the base knit texture continues through and around the logo, logo is flush with the fabric (not raised, not a sticker, not printed ink). Fine running-stitch or back-stitch strokes form the logo shape directly in the fabric.
4. Background: fully TRANSPARENT PNG (alpha). No floor, no shadow.

Quality standard — match QUALITY SAMPLE exactly:
• Photorealistic athletic crew sock, tight performance knit, studio directional lighting.
• Fine knit mesh grid visible across entire sock surface; cuff rib columns clearly defined.
• Logo: clean, horizontal, readable — stitched INTO the fabric surface, knit texture visible through letterforms.
• Fully transparent background, e-commerce product photo grade.
`.trim();

/** 업로드 이미지에서 플랫 누끼(배경 제거)만 */
const SYSTEM_INSTRUCTION_CUTOUT = `
You are a flat artwork extractor. You MUST output exactly ONE raster image (PNG) as inline image data.

Never respond with text-only explanations. If you cannot fully isolate, still output your best attempt as an image.
Isolate the sock design / print / pattern from the input as a flat 2D graphic. Remove all background (full alpha outside the design). Do NOT output 3D mockups or new camera angles.
Preserve colors, stripes, and logos faithfully.
`.trim();

type GeneratedItem = {
  key: string;
  label: string;
  imageData?: string;
  mimeType?: string;
  error?: string;
};

/** Gemini가 텍스트만 주거나 이미지가 다른 candidate에 있을 때 대비 — 전부 순회 */
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
    const parts = c.content?.parts ?? [];
    for (const p of parts) {
      if (p && 'inlineData' in p && p.inlineData?.data) {
        return {
          imageData: p.inlineData.data,
          mimeType: p.inlineData.mimeType ?? 'image/png',
          diagnostic: '',
        };
      }
    }
  }
  const block = result.response.promptFeedback?.blockReason;
  const diag = [
    `candidates=${candidates.length}`,
    finish.length ? `finish=${finish.join(';')}` : '',
    block ? `promptBlock=${String(block)}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return { diagnostic: diag || 'no_image' };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function generateMockup(
  genAI: GoogleGenerativeAI,
  imageBase64: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
  extraPrompt: string,
  styleReferenceBase64: string | null,
  itemKey: string,
  itemLabel: string
): Promise<GeneratedItem> {
  const hasReference = !!styleReferenceBase64;

  const prompt = `TASK: One photorealistic sock product mockup (transparent PNG).

IMAGE ROLES (do not swap):
- Image 1 = DESIGN SOURCE only: extract colors, stripes, logos, repeats, textures — these go ON the fabric.
${hasReference ? `- Image 2 = STRUCTURE MASTER (primary): your output must match this image's sock shape, length, pair layout, camera angle, perspective, and framing. This is the fixed template; deviation is NOT allowed.` : ''}

PIPELINE:
1. Lock onto ${hasReference ? 'Image 2' : 'a consistent professional product shot'}: memorize silhouette, height, angle, and where each sock sits in the frame.
2. Map Image 1's artwork onto those sock surfaces only (texture projection). Do not let Image 1 change length, angle, or layout.
3. Final check: side‑by‑side with ${hasReference ? 'Image 2' : 'your locked composition'} — geometry and shot must match the master; only the printed/knit graphics differ.
4. Background: FULLY TRANSPARENT. No floor blob.

${extraPrompt ? `User/product notes (must not override STRUCTURE MASTER geometry): ${extraPrompt}` : ''}

Generate the image now.`;

  const systemInstruction = !hasReference ? SYSTEM_INSTRUCTION_DESIGN_ONLY : SYSTEM_INSTRUCTION;

  try {
    const model = genAI.getGenerativeModel({
      model: IMAGE_MODEL,
      systemInstruction,
      generationConfig: {
        // @ts-expect-error responseModalities not yet in SDK types
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    const contentParts: Parameters<typeof model.generateContent>[0] = [
      prompt,
      { inlineData: { mimeType, data: imageBase64 } },
      ...(styleReferenceBase64
        ? [{ inlineData: { mimeType: 'image/png' as const, data: styleReferenceBase64 } }]
        : []),
    ];

    const result = await model.generateContent(contentParts);
    const picked = pickFirstInlineImage(result);

    return {
      key: itemKey,
      label: itemLabel,
      imageData: picked.imageData,
      mimeType: picked.mimeType ?? 'image/png',
      error: picked.imageData
        ? undefined
        : `이미지를 받지 못했습니다${picked.diagnostic ? ` (${picked.diagnostic})` : ''}`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { key: itemKey, label: itemLabel, error: msg };
  }
}

async function generateDesignCutoutOnce(
  genAI: GoogleGenerativeAI,
  imageBase64: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
  extraPrompt: string
): Promise<GeneratedItem> {
  const prompt = `TASK: Cutout — you MUST return one PNG image (inline image), not text only.

Keep only the sock design / print / pattern; background fully transparent (alpha). Remove floor, shadows, clutter.
No 3D mockup, no new camera angle.
${extraPrompt ? `\nContext: ${extraPrompt}` : ''}

Output the PNG image now.`;

  try {
    const model = genAI.getGenerativeModel({
      model: IMAGE_MODEL,
      systemInstruction: SYSTEM_INSTRUCTION_CUTOUT,
      generationConfig: {
        // @ts-expect-error responseModalities not yet in SDK types
        responseModalities: ['IMAGE', 'TEXT'],
      },
    });

    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType, data: imageBase64 } },
    ]);

    const picked = pickFirstInlineImage(result);
    return {
      key: 'cutout',
      label: '누끼 (플랫)',
      imageData: picked.imageData,
      mimeType: picked.mimeType ?? 'image/png',
      error: picked.imageData
        ? undefined
        : `이미지를 받지 못했습니다${picked.diagnostic ? ` (${picked.diagnostic})` : ''}`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { key: 'cutout', label: '누끼 (플랫)', error: msg };
  }
}

async function generateCrewLogoMockup(
  genAI: GoogleGenerativeAI,
  designBase64: string,
  designMime: 'image/jpeg' | 'image/png' | 'image/webp',
  logoBase64: string,
  logoMime: 'image/jpeg' | 'image/png' | 'image/webp',
  crewLogoRefBase64: string
): Promise<GeneratedItem> {
  const hasSample = !!crewLogoSampleBase64;

  const prompt = `TASK: One photorealistic crew sock mockup (transparent PNG) with logo placed in the RED-BORDERED area.

IMAGE ROLES (do not swap):
- Image 1 = DESIGN SOURCE: colors, stripes, patterns that go on the fabric.
- Image 2 = LOGO: the graphic to stitch into the RED-BORDERED area.
- Image 3 = CREW LOGO REFERENCE: layout master — sock shape, pair layout, camera angle, RED-BORDERED rectangle position.
${hasSample ? '- Image 4 = QUALITY SAMPLE: gold-standard output. Replicate its photorealism, knit texture, logo integration, and overall finish exactly.' : ''}

PIPELINE:
1. Lock onto Image 3 geometry and framing.
2. Wrap Image 1 artwork onto sock surfaces — knit stitch texture, color IN the yarn, rib columns continuous across all zones.
3. Place Image 2 logo inside the RED-BORDERED area — horizontal ONLY (0° rotation, perfectly level). Render as stitch/knit text woven into the fabric: individual stitch lines form each letterform, base knit texture shows through and around the logo, flush with the fabric surface (not raised, not a sticker). Fine running-stitch or back-stitch strokes build the logo shape directly in the fabric.
4. Background: fully TRANSPARENT. No floor blob.
${hasSample ? '5. Final check: compare to Image 4 QUALITY SAMPLE — match its texture detail, logo clarity, lighting, and e-commerce finish.' : ''}

Generate the image now.`;

  try {
    const model = genAI.getGenerativeModel({
      model: IMAGE_MODEL,
      systemInstruction: SYSTEM_INSTRUCTION_CREW_LOGO,
      generationConfig: {
        // @ts-expect-error responseModalities not yet in SDK types
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    const contentParts: Parameters<typeof model.generateContent>[0] = [
      prompt,
      { inlineData: { mimeType: designMime, data: designBase64 } },
      { inlineData: { mimeType: logoMime, data: logoBase64 } },
      { inlineData: { mimeType: 'image/png' as const, data: crewLogoRefBase64 } },
      ...(crewLogoSampleBase64
        ? [{ inlineData: { mimeType: 'image/png' as const, data: crewLogoSampleBase64 } }]
        : []),
    ];

    const result = await model.generateContent(contentParts);

    const picked = pickFirstInlineImage(result);
    return {
      key: 'crew_logo',
      label: '크루 로고 배치',
      imageData: picked.imageData,
      mimeType: picked.mimeType ?? 'image/png',
      error: picked.imageData
        ? undefined
        : `이미지를 받지 못했습니다${picked.diagnostic ? ` (${picked.diagnostic})` : ''}`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { key: 'crew_logo', label: '크루 로고 배치', error: msg };
  }
}

/** 이미지 전용 모델이 가끔 텍스트만 주는 경우 재시도 */
async function generateDesignCutout(
  genAI: GoogleGenerativeAI,
  imageBase64: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
  extraPrompt: string
): Promise<GeneratedItem> {
  const maxAttempts = 3;
  let last: GeneratedItem = {
    key: 'cutout',
    label: '누끼 (플랫)',
    error: '이미지를 받지 못했습니다',
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    last = await generateDesignCutoutOnce(genAI, imageBase64, mimeType, extraPrompt);
    if (last.imageData) {
      if (attempt > 1) {
        console.warn(`[Nano][cutout] succeeded on attempt ${attempt}`);
      }
      return last;
    }
    console.warn(`[Nano][cutout] attempt ${attempt}/${maxAttempts} no image`, last.error ?? '');
    if (attempt < maxAttempts) {
      await sleep(400 * attempt);
    }
  }

  return last;
}

export function getNanoGuideline(_req: AuthRequest, res: Response): void {
  res.json({ guideline: SYSTEM_INSTRUCTION });
}

export async function postNanoGenerate(req: AuthRequest, res: Response): Promise<void> {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const file = files?.['image']?.[0];
  const logoFile = files?.['logo']?.[0];

  const extraPrompt = typeof req.body.prompt === 'string' ? req.body.prompt.trim() : '';
  const sockType =
    typeof req.body.sockType === 'string' ? req.body.sockType.trim() : undefined;

  if (!file) {
    res.status(400).json({ message: '이미지 파일이 필요합니다.' });
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

    const jobs = getMockupJobs(sockType);
    const mockupTasks =
      jobs.length > 0
        ? jobs.map((j) =>
            generateMockup(
              genAI,
              imageBase64,
              mimeType,
              extraPrompt,
              j.refBase64,
              j.key,
              j.label
            )
          )
        : [
            generateMockup(
              genAI,
              imageBase64,
              mimeType,
              extraPrompt,
              null,
              'front',
              '앞대각선 (좌+우 2짝)'
            ),
          ];

    const cutoutTask = generateDesignCutout(genAI, imageBase64, mimeType, extraPrompt);

    const isCrewWithLogo =
      sockType?.toLowerCase() === 'crew' && !!logoFile && !!crewLogoReferenceBase64;

    const crewLogoTask = isCrewWithLogo
      ? generateCrewLogoMockup(
          genAI,
          imageBase64,
          mimeType,
          logoFile!.buffer.toString('base64'),
          logoFile!.mimetype as 'image/jpeg' | 'image/png' | 'image/webp',
          crewLogoReferenceBase64!
        )
      : null;

    const settled = await Promise.all([
      ...mockupTasks,
      cutoutTask,
      ...(crewLogoTask ? [crewLogoTask] : []),
    ]);

    res.json({ images: settled });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[NanoGenerate]', msg);
    res.status(500).json({ message: msg });
  }
}
