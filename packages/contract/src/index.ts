// @ripple/contract — API 契约唯一事实来源（zod schema + 推断类型）
export * from './common.js';
export * from './user.js';
export * from './auth.js';
export * from './skill.js';
export * from './interaction.js';
export * from './ripple.js';
export * from './comment.js';
export * from './collection.js';
export * from './follow.js';
export * from './admin.js';
export * from './meta.js';
export * from './ai.js';

/** 游客会话头名称（前端 localStorage 持久化 UUID） */
export const GUEST_SESSION_HEADER = 'X-Ripple-Guest-Session';
/** 游客会话 key 格式 */
export const GUEST_SESSION_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/** 热度公式权重（传播×1 + 收藏×2 + 评论×4 + 查询×0.05） */
export const HEAT_WEIGHTS = {
  spread: 1,
  favorite: 2,
  comment: 4,
  view: 0.05,
} as const;

/** 周归一化分母下限，避免小流量期热度剧烈波动 */
export const HEAT_NORMALIZATION_FLOOR = 100;

export function computeHeatRaw(counts: {
  ripples: number;
  likes: number;
  comments: number;
  views: number;
}): number {
  return (
    counts.ripples * HEAT_WEIGHTS.spread +
    counts.likes * HEAT_WEIGHTS.favorite +
    counts.comments * HEAT_WEIGHTS.comment +
    counts.views * HEAT_WEIGHTS.view
  );
}

export function normalizeHeat(heatRaw: number, weeklyMax: number): number {
  const denominator = Math.max(weeklyMax, HEAT_NORMALIZATION_FLOOR);
  return Math.max(0, Math.min(100, Math.round((100 * heatRaw) / denominator)));
}
