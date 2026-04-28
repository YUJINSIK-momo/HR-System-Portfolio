/**
 * 프론트 `extractMentionTagsFromContent`와 동일 — 본문의 @표시명을 알려진 이름 목록과 매칭.
 */
export function extractMentionTagsFromContent(text: string, knownDisplayNames: string[]): string[] {
  const names = [...new Set(knownDisplayNames.map((n) => n.trim()).filter(Boolean))].sort(
    (a, b) => b.length - a.length
  );
  const found = new Set<string>();
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`@${escaped}(?=\\s|$|\\n|\\r)`, 'g');
    if (re.test(text)) found.add(name);
  }
  return Array.from(found).slice(0, 20);
}
