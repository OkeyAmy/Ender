export function extractJsonObject(text: string): string | null {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

export function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
