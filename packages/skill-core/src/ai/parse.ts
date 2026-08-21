import type { z } from 'zod';

/** 提取首个花括号配对完整的 JSON 对象（容忍前后废话） */
export function extractBalancedObject(raw: string): string | null {
  const start = raw.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      if (inString) escaped = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null;
}

/** LLM JSON 输出多级兜底解析：原文 → 剥围栏 → 括号配对提取 */
export function parseLlmJson<T>(raw: string, schema: z.ZodType<T>): T | null {
  const attempts = [
    raw,
    raw.replace(/^[\s\S]*?```(?:json)?\s*/i, '').replace(/\s*```[\s\S]*$/, ''),
    extractBalancedObject(raw),
  ];
  for (const text of attempts) {
    if (!text) continue;
    try {
      const result = schema.safeParse(JSON.parse(text));
      if (result.success) return result.data;
    } catch {
      /* 下一种 */
    }
  }
  return null;
}
