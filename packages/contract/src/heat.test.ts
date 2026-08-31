import { describe, expect, it } from 'vitest';
import { computeHeatRaw, HEAT_NORMALIZATION_FLOOR, normalizeHeat } from './index.js';

describe('computeHeatRaw', () => {
  it('按 传播×1 + 收藏×2 + 评论×4 + 查询×0.05 加权', () => {
    expect(computeHeatRaw({ ripples: 10, likes: 5, comments: 2, views: 100 })).toBe(
      10 * 1 + 5 * 2 + 2 * 4 + 100 * 0.05,
    );
  });

  it('零互动为 0', () => {
    expect(computeHeatRaw({ ripples: 0, likes: 0, comments: 0, views: 0 })).toBe(0);
  });

  it('新增一次点赞 heat_raw 增加 2', () => {
    const before = computeHeatRaw({ ripples: 3, likes: 1, comments: 0, views: 40 });
    const after = computeHeatRaw({ ripples: 3, likes: 2, comments: 0, views: 40 });
    expect(after - before).toBe(2);
  });
});

describe('normalizeHeat', () => {
  it('周最大值处为 100', () => {
    expect(normalizeHeat(500, 500)).toBe(100);
  });

  it('结果限定在 0-100 区间', () => {
    expect(normalizeHeat(1000, 500)).toBe(100);
    expect(normalizeHeat(0, 500)).toBe(0);
  });

  it('分母有下限，小流量期不放大', () => {
    // weeklyMax=10 < floor 时按 floor 归一化
    expect(normalizeHeat(10, 10)).toBe(Math.round((100 * 10) / HEAT_NORMALIZATION_FLOOR));
  });
});
