import type { OriginType, SkillStats } from '@ripple/contract';

/** 1234 → 1.2k */
export function fmtCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/** ISO 时间 → 相对时间中文 */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  if (mins < 1440) return `${Math.floor(mins / 60)} 小时前`;
  if (mins < 43200) return `${Math.floor(mins / 1440)} 天前`;
  return new Date(iso).toISOString().slice(0, 10);
}

export const ORIGIN_LABELS: Record<OriginType, string> = {
  original: '原创',
  derivative: '二创',
  repost: '搬运',
};

/** 原型硬编码的六个分类 */
export const CATEGORIES = ['工程架构', 'GitHub 工作流', '工具链', '设计', '数据', 'AI'] as const;

/** 热度公式提示（卡片/统计条 title） */
export const HEAT_FORMULA_HINT = '热度 = 传播×1 + 收藏×2 + 评论×4 + 查询×0.05，按周归一化';

/** 用户显示名：昵称优先，缺省用邮箱前缀 */
export function displayName(user: { nickname: string | null; email: string }): string {
  return user.nickname ?? user.email.split('@')[0];
}

/** 热度分解四项（预览弹窗条形图） */
export function heatBars(stats: SkillStats): { label: string; value: number }[] {
  return [
    { label: '传播', value: stats.ripple_count },
    { label: '收藏', value: stats.like_count },
    { label: '评论', value: stats.comment_count },
    { label: '查询', value: stats.view_count },
  ];
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
