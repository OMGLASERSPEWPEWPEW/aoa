const SCHEDULE_PRICE_GUARD = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\$\d|(\d{1,2}:\d{2})/i;

function fnv1a(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(36);
}

function normalizeBlock(block: string): string {
  return block.toLowerCase().replace(/\s+/g, " ").trim();
}

export function stripBoilerplate(
  cleaned: string,
  blockHashes: Record<string, number>,
): { stripped: string; updatedHashes: Record<string, number>; droppedCount: number } {
  const blocks = cleaned.split(/\n{2,}/);
  const kept: string[] = [];
  let droppedCount = 0;
  const newHashes: Record<string, number> = { ...blockHashes };

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const norm = normalizeBlock(trimmed);
    const h = fnv1a(norm);

    if ((newHashes[h] ?? 0) >= 2 && !SCHEDULE_PRICE_GUARD.test(trimmed)) {
      droppedCount++;
    } else {
      kept.push(trimmed);
    }
  }

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const norm = normalizeBlock(trimmed);
    const h = fnv1a(norm);
    newHashes[h] = (newHashes[h] ?? 0) + 1;
  }

  return {
    stripped: kept.join("\n\n"),
    updatedHashes: newHashes,
    droppedCount,
  };
}
