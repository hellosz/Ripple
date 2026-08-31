import { z } from 'zod';
import { ratingSchema } from './common.js';

export const aiSourceSchema = z.enum(['llm', 'fallback']);
export type AiSource = z.infer<typeof aiSourceSchema>;

export const aiDimensionKeySchema = z.enum([
  'trigger',
  'disclosure',
  'actionability',
  'structure',
  'determinism',
  'clarity',
]);
export type AiDimensionKey = z.infer<typeof aiDimensionKeySchema>;

/** LLM 原始输出（total/grade 由客户端重算，不采信 LLM 算术） */
export const aiScoreRawSchema = z.object({
  dimensions: z
    .array(
      z.object({
        key: aiDimensionKeySchema,
        name: z.string(),
        // reason 在 score 之前：先陈述证据再打分
        reason: z.string().min(1),
        score: z.number().int().min(0).max(100),
      }),
    )
    .length(6),
  summary: z.string().min(1),
});
export type AiScoreRaw = z.infer<typeof aiScoreRawSchema>;

export const aiScoreResultSchema = aiScoreRawSchema.extend({
  total: z.number().int().min(0).max(100),
  grade: ratingSchema,
  source: aiSourceSchema,
});
export type AiScoreResult = z.infer<typeof aiScoreResultSchema>;

export const aiPatchSchema = z.object({
  /** 白名单：仅允许 SKILL.md 与 references/ 下的 .md */
  path: z.string().regex(/^(SKILL\.md|references\/[\w./-]+\.md)$/),
  new_content: z.string().min(1),
  rationale: z.string().min(1),
});
export type AiPatch = z.infer<typeof aiPatchSchema>;

export const aiSuggestRawSchema = z.object({
  suggestions: z
    .array(
      z.object({
        type: z.enum(['business', 'technical']),
        title: z.string().min(1).max(60),
        detail: z.string().min(1),
      }),
    )
    .min(1)
    .max(8),
  patches: z.array(aiPatchSchema).max(5),
});
export type AiSuggestRaw = z.infer<typeof aiSuggestRawSchema>;

export const aiSuggestResultSchema = aiSuggestRawSchema.extend({
  source: aiSourceSchema,
});
export type AiSuggestResult = z.infer<typeof aiSuggestResultSchema>;

/** 应用场景分析（LLM 原始输出） */
export const aiScenarioRawSchema = z.object({
  tags: z.object({
    business: z.array(z.string().min(1).max(20)).min(1).max(6),
    role: z.array(z.string().min(1).max(20)).min(1).max(6),
    scene: z.array(z.string().min(1).max(20)).min(1).max(6),
    tool: z.array(z.string().min(1).max(20)).max(6),
  }),
  summary: z.string().min(1).max(200),
});
export type AiScenarioRaw = z.infer<typeof aiScenarioRawSchema>;

/** AI 调用用量日志条目 */
export const aiUsageEntrySchema = z.object({
  at: z.string(),
  feature: z.enum(['score', 'optimize', 'scenario', 'test']),
  model: z.string(),
  prompt_tokens: z.number().int().nonnegative(),
  completion_tokens: z.number().int().nonnegative(),
  /** 估算费用（美元）；custom 服务商无单价表时为 null */
  cost_usd: z.number().nonnegative().nullable(),
});
export type AiUsageEntry = z.infer<typeof aiUsageEntrySchema>;
