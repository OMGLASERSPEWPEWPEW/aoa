export function repairJson(raw: string): unknown | null {
  if (!raw || typeof raw !== "string") return null;

  let text = raw.trim();

  if (text.startsWith("```")) {
    text = text.startsWith("```json")
      ? text.slice("```json".length)
      : text.slice("```".length);
    text = text.trim();
    if (text.endsWith("```")) text = text.slice(0, -"```".length);
    text = text.trim();

    try { return JSON.parse(text); } catch { /* continue */ }
  }

  try { return JSON.parse(text); } catch { /* continue */ }

  const firstBrace = text.indexOf("{");
  const firstBracket = text.indexOf("[");
  let start = -1;
  let end = -1;

  if (firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket)) {
    start = firstBrace;
    end = text.lastIndexOf("}");
  } else if (firstBracket >= 0) {
    start = firstBracket;
    end = text.lastIndexOf("]");
  }

  if (start >= 0 && end > start) {
    try { return JSON.parse(text.substring(start, end + 1)); } catch { /* continue */ }
  }

  return null;
}
