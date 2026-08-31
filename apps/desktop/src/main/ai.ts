import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { app, safeStorage } from 'electron';
import type { AiUsageEntry } from '@ripple/contract';

/** 单价表（美元 / 1M tokens；估算用，custom 模型不在表内则不计费） */
const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'deepseek-chat': { input: 0.27, output: 1.1 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },
};

export type AiFeature = AiUsageEntry['feature'];

export type AiProvider = 'openai' | 'deepseek' | 'custom';

export interface AiConfigPublic {
  provider: AiProvider;
  baseUrl: string;
  model: string;
  hasKey: boolean;
}

interface AiConfigFile {
  provider: AiProvider;
  baseUrl: string;
  model: string;
  /** safeStorage 加密 base64；不可用环境为明文（encrypted=false） */
  apiKey?: string;
  encrypted?: boolean;
}

export const AI_PROVIDER_DEFAULTS: Record<Exclude<AiProvider, 'custom'>, { baseUrl: string; model: string }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
};

const DEFAULT_CONFIG: AiConfigFile = {
  provider: 'deepseek',
  baseUrl: AI_PROVIDER_DEFAULTS.deepseek.baseUrl,
  model: AI_PROVIDER_DEFAULTS.deepseek.model,
};

export class AiService {
  private file: string;
  private usageFile: string;
  private usage: AiUsageEntry[] = [];
  private config: AiConfigFile = { ...DEFAULT_CONFIG };

  constructor() {
    this.file = join(app.getPath('userData'), 'ai.json');
    this.usageFile = join(app.getPath('userData'), 'ai-usage.json');
    try {
      this.config = { ...DEFAULT_CONFIG, ...(JSON.parse(readFileSync(this.file, 'utf8')) as AiConfigFile) };
    } catch {
      /* 首次使用 */
    }
    try {
      this.usage = JSON.parse(readFileSync(this.usageFile, 'utf8')) as AiUsageEntry[];
    } catch {
      /* 无历史用量 */
    }
  }

  private recordUsage(feature: AiFeature, promptTokens: number, completionTokens: number): void {
    const price = MODEL_PRICES[this.config.model];
    const cost = price
      ? (promptTokens * price.input + completionTokens * price.output) / 1_000_000
      : null;
    this.usage.unshift({
      at: new Date().toISOString(),
      feature,
      model: this.config.model,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      cost_usd: cost,
    });
    if (this.usage.length > 200) this.usage.length = 200;
    try {
      mkdirSync(dirname(this.usageFile), { recursive: true });
      writeFileSync(this.usageFile, JSON.stringify(this.usage));
    } catch {
      /* 用量写盘失败不影响功能 */
    }
  }

  getUsage(): {
    entries: AiUsageEntry[];
    totals: { calls: number; prompt_tokens: number; completion_tokens: number; cost_usd: number };
  } {
    const totals = { calls: this.usage.length, prompt_tokens: 0, completion_tokens: 0, cost_usd: 0 };
    for (const entry of this.usage) {
      totals.prompt_tokens += entry.prompt_tokens;
      totals.completion_tokens += entry.completion_tokens;
      totals.cost_usd += entry.cost_usd ?? 0;
    }
    return { entries: this.usage, totals };
  }

  private save(): void {
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(this.config), { mode: 0o600 });
  }

  private get apiKey(): string | null {
    if (!this.config.apiKey) return null;
    if (this.config.encrypted) {
      try {
        return safeStorage.decryptString(Buffer.from(this.config.apiKey, 'base64'));
      } catch {
        return null;
      }
    }
    return this.config.apiKey;
  }

  getConfig(): AiConfigPublic {
    return {
      provider: this.config.provider,
      baseUrl: this.config.baseUrl,
      model: this.config.model,
      hasKey: Boolean(this.config.apiKey),
    };
  }

  setConfig(input: { provider: AiProvider; baseUrl?: string; model?: string; apiKey?: string }): AiConfigPublic {
    const defaults = input.provider === 'custom' ? null : AI_PROVIDER_DEFAULTS[input.provider];
    this.config.provider = input.provider;
    this.config.baseUrl = (input.baseUrl?.trim() || defaults?.baseUrl || this.config.baseUrl).replace(/\/$/, '');
    this.config.model = input.model?.trim() || defaults?.model || this.config.model;
    if (input.apiKey !== undefined) {
      const key = input.apiKey.trim();
      if (!key) {
        delete this.config.apiKey;
        delete this.config.encrypted;
      } else if (safeStorage.isEncryptionAvailable()) {
        this.config.apiKey = safeStorage.encryptString(key).toString('base64');
        this.config.encrypted = true;
      } else {
        this.config.apiKey = key;
        this.config.encrypted = false;
      }
    }
    this.save();
    return this.getConfig();
  }

  /** OpenAI 兼容 chat completions；json=true 时要求纯 JSON 输出并做剥离/重试 */
  async chat(
    messages: Array<{ role: 'system' | 'user'; content: string }>,
    opts: { json?: boolean; feature?: AiFeature } = {},
  ): Promise<string> {
    const key = this.apiKey;
    if (!key) throw new Error('未配置 AI 服务商 API Key（设置 → AI 服务商）');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0,
          messages,
          ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`AI 服务返回 HTTP ${response.status}${body ? `：${body.slice(0, 200)}` : ''}`);
      }
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      this.recordUsage(
        opts.feature ?? 'test',
        data.usage?.prompt_tokens ?? 0,
        data.usage?.completion_tokens ?? 0,
      );
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('AI 服务返回空内容');
      return content;
    } finally {
      clearTimeout(timer);
    }
  }

  /** 调 JSON 任务：剥 code fence + 解析失败自动重试一次 */
  async chatJson<T>(
    messages: Array<{ role: 'system' | 'user'; content: string }>,
    validate: (v: unknown) => T,
    feature: AiFeature = 'test',
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await this.chat(messages, { json: true, feature });
        const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
        return validate(JSON.parse(stripped));
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('AI 输出解析失败');
  }

  async test(): Promise<{ ok: boolean; message: string }> {
    try {
      const reply = await this.chat([{ role: 'user', content: '仅回复"ok"两个字母。' }], { feature: 'test' });
      return { ok: true, message: `连接成功（${this.config.model}）：${reply.slice(0, 40)}` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }
}

// ---- SKILL 评分与优化（方案依据 openspec/changes/skill-ai + 调研报告）----

import { createHash } from 'node:crypto';
import {
  AI_PROMPT_VERSION,
  SCENARIO_SYSTEM_PROMPT,
  SCORE_SYSTEM_PROMPT,
  SUGGEST_SYSTEM_PROMPT,
  buildSkillAiInput,
  computeAiTotal,
  gradeOfTotal,
  FALLBACK_GRADE_SCORE,
  parseLlmJson,
  parseFrontmatter,
  extractSkillMeta,
  rateSkill,
  hasAgentsDirectory,
  type SkillFileInput,
} from '@ripple/skill-core';
import {
  aiScenarioRawSchema,
  aiScoreRawSchema,
  aiSuggestRawSchema,
  type AiScenarioRaw,
  type AiScoreResult,
  type AiSuggestResult,
} from '@ripple/contract';

const DIMENSION_NAMES: Record<string, string> = {
  trigger: '触发精准度',
  disclosure: '渐进式披露与 token 效率',
  actionability: '可执行性',
  structure: '结构与规范',
  determinism: '脚本与确定性',
  clarity: '清晰一致性',
};

export class SkillAiFeatures {
  private scoreCache = new Map<string, AiScoreResult>();

  constructor(private readonly ai: AiService) {}

  private cacheKey(files: SkillFileInput[]): string {
    const hash = createHash('sha256');
    for (const f of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
      hash.update(f.path).update('\0').update(f.content).update('\0');
    }
    const cfg = this.ai.getConfig();
    hash.update(`${cfg.baseUrl}|${cfg.model}|${AI_PROMPT_VERSION}`);
    return hash.digest('hex');
  }

  private fallbackScore(files: SkillFileInput[]): AiScoreResult {
    const md = files.find((f) => f.path === 'SKILL.md')?.content ?? '';
    const meta = extractSkillMeta(parseFrontmatter(md));
    const { rating } = rateSkill(
      md,
      { description: meta.ok ? meta.meta.description : '' },
      hasAgentsDirectory(files.map((f) => f.path)),
    );
    const score = FALLBACK_GRADE_SCORE[rating];
    return {
      total: score,
      grade: rating,
      dimensions: (Object.keys(DIMENSION_NAMES) as Array<keyof typeof DIMENSION_NAMES>).map(
        (key) => ({
          key: key as never,
          name: DIMENSION_NAMES[key]!,
          reason: '本地规则评级（LLM 不可用）',
          score,
        }),
      ),
      summary: `LLM 不可用，按本地规则评级为 ${rating}。配置 AI 服务商后可获得分维度评分。`,
      source: 'fallback',
    };
  }

  async score(files: SkillFileInput[], extraContext?: string): Promise<AiScoreResult> {
    const key = this.cacheKey(files) + (extraContext ? `|${createHash('sha256').update(extraContext).digest('hex').slice(0, 12)}` : '');
    const cached = this.scoreCache.get(key);
    if (cached) return cached;
    let { user } = buildSkillAiInput(files, 'score');
    if (extraContext) user += `\n\n${extraContext}`;
    let result: AiScoreResult;
    try {
      const raw = await this.ai.chatJson(
        [
          { role: 'system', content: SCORE_SYSTEM_PROMPT },
          { role: 'user', content: user },
        ],
        (v) => {
          const parsed = parseLlmJson(JSON.stringify(v), aiScoreRawSchema) ?? aiScoreRawSchema.parse(v);
          return parsed;
        },
        'score',
      );
      const total = computeAiTotal(raw.dimensions);
      result = { ...raw, total, grade: gradeOfTotal(total), source: 'llm' };
    } catch {
      result = this.fallbackScore(files);
    }
    if (result.source === 'llm') this.scoreCache.set(key, result);
    return result;
  }

  async optimize(files: SkillFileInput[], extraContext?: string): Promise<AiSuggestResult> {
    let { user } = buildSkillAiInput(files, 'suggest');
    if (extraContext) user += `\n\n${extraContext}`;
    try {
      const raw = await this.ai.chatJson(
        [
          { role: 'system', content: SUGGEST_SYSTEM_PROMPT },
          { role: 'user', content: user },
        ],
        (v) => parseLlmJson(JSON.stringify(v), aiSuggestRawSchema) ?? aiSuggestRawSchema.parse(v),
        'optimize',
      );
      // patch 落盘前校验：SKILL.md 必须保留合法 frontmatter 且 name 未改
      const originalName = (() => {
        const md = files.find((f) => f.path === 'SKILL.md')?.content ?? '';
        const meta = extractSkillMeta(parseFrontmatter(md));
        return meta.ok ? meta.meta.name : null;
      })();
      const patches = raw.patches.filter((patch) => {
        if (patch.path !== 'SKILL.md') return true;
        const meta = extractSkillMeta(parseFrontmatter(patch.new_content));
        return meta.ok && (!originalName || meta.meta.name === originalName);
      });
      const demoted = raw.patches.length - patches.length;
      const suggestions = [...raw.suggestions];
      if (demoted > 0) {
        suggestions.push({
          type: 'technical',
          title: '部分补丁未通过校验',
          detail: `${demoted} 个 SKILL.md 补丁因 frontmatter 非法或 name 被改动而降级为建议，请人工核对。`,
        });
      }
      return { suggestions, patches, source: 'llm' };
    } catch {
      // 降级：本地规则建议
      const md = files.find((f) => f.path === 'SKILL.md')?.content ?? '';
      const meta = extractSkillMeta(parseFrontmatter(md));
      const { suggestions } = rateSkill(
        md,
        { description: meta.ok ? meta.meta.description : '' },
        hasAgentsDirectory(files.map((f) => f.path)),
      );
      return {
        suggestions: (suggestions.length ? suggestions : ['配置 AI 服务商后可获得深度优化建议']).map(
          (s) => ({ type: 'technical' as const, title: s.slice(0, 30), detail: s }),
        ),
        patches: [],
        source: 'fallback',
      };
    }
  }
}

export async function analyzeScenario(
  ai: AiService,
  files: SkillFileInput[],
): Promise<AiScenarioRaw> {
  const { user } = buildSkillAiInput(files, 'score');
  return ai.chatJson(
    [
      { role: 'system', content: SCENARIO_SYSTEM_PROMPT },
      { role: 'user', content: user },
    ],
    (v) => parseLlmJson(JSON.stringify(v), aiScenarioRawSchema) ?? aiScenarioRawSchema.parse(v),
    'scenario',
  );
}
