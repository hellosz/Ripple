/** 粗略 token 估算：ASCII /4 + 非 ASCII /1.6（无需精确，仅做预算裁剪） */
export function estimateTokens(text: string): number {
  let ascii = 0;
  let other = 0;
  for (const ch of text) {
    if ((ch.codePointAt(0) ?? 0) < 128) ascii++;
    else other++;
  }
  return Math.ceil(ascii / 4 + other / 1.6);
}

/** 按 token 预算截断：保头 + 保尾，中间标注截断行数 */
export function truncateByTokens(
  text: string,
  budget: number,
  headRatio = 0.75,
): { text: string; truncated: boolean } {
  if (estimateTokens(text) <= budget) return { text, truncated: false };
  const lines = text.split('\n');
  const headBudget = Math.floor(budget * headRatio);
  const tailBudget = budget - headBudget;
  const head: string[] = [];
  const tail: string[] = [];
  let used = 0;
  for (const line of lines) {
    const cost = estimateTokens(line) + 1;
    if (used + cost > headBudget) break;
    head.push(line);
    used += cost;
  }
  used = 0;
  for (let i = lines.length - 1; i >= head.length; i--) {
    const cost = estimateTokens(lines[i]!) + 1;
    if (used + cost > tailBudget) break;
    tail.unshift(lines[i]!);
    used += cost;
  }
  const omitted = lines.length - head.length - tail.length;
  return {
    text: `${head.join('\n')}\n…[已截断 ${omitted} 行]…\n${tail.join('\n')}`,
    truncated: true,
  };
}
