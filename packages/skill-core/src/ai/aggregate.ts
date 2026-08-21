import type { AiDimensionKey, AiScoreRaw } from '@ripple/contract';
import type { Rating } from '@ripple/contract';

/** 维度权重（trigger 最高：description 是触发/防误唤醒的唯一信号面） */
export const AI_SCORE_WEIGHTS: Record<AiDimensionKey, number> = {
  trigger: 0.25,
  disclosure: 0.2,
  actionability: 0.2,
  structure: 0.15,
  determinism: 0.1,
  clarity: 0.1,
};

/** 总分由客户端加权计算（不采信 LLM 算术） */
export function computeAiTotal(dimensions: AiScoreRaw['dimensions']): number {
  return Math.round(
    dimensions.reduce((sum, d) => sum + d.score * (AI_SCORE_WEIGHTS[d.key] ?? 0), 0),
  );
}

/** 与现有本地评级对齐：S(夯)≥85, A(稳)≥70, B(行)≥55, C(拉)<55 */
export function gradeOfTotal(total: number): Rating {
  if (total >= 85) return 'S';
  if (total >= 70) return 'A';
  if (total >= 55) return 'B';
  return 'C';
}

/** 降级映射：本地规则评级 → 统一分数 */
export const FALLBACK_GRADE_SCORE: Record<Rating, number> = { S: 90, A: 75, B: 58, C: 40 };
