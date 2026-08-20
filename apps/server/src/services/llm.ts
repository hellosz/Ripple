import type { ProfileCandidate } from '@ripple/contract';

export interface LlmOptions {
  apiKey: string;
  baseUrl: string;
}

const FALLBACK_CANDIDATES: ProfileCandidate[] = [
  { nickname: '涟漪观测员', description: '在技能的海面上记录每一圈扩散的波纹。' },
  { nickname: '静水深流', description: '话不多，分享的技能都经过深思熟虑。' },
  { nickname: '雨滴收藏家', description: '收集每一个落进社区的好点子。' },
  { nickname: '波纹信使', description: '把好用的技能传递给下一个需要的人。' },
  { nickname: '深潜者', description: '喜欢潜入工具链的深处寻找效率的宝藏。' },
  { nickname: '水面画师', description: '相信每一次分享都能画出漂亮的涟漪。' },
];

export class LlmService {
  constructor(private readonly opts: LlmOptions) {}

  async generateProfileCandidates(input: {
    gender: string | null;
    zodiac: string | null;
    tags: string[] | null;
  }): Promise<{ candidates: ProfileCandidate[]; source: 'llm' | 'fallback' }> {
    if (!this.opts.apiKey) {
      return { candidates: FALLBACK_CANDIDATES, source: 'fallback' };
    }
    try {
      const prompt = [
        '你是一个中文社区的昵称生成器。根据用户画像生成 6 组昵称与一句话描述。',
        `性别：${input.gender ?? '保密'}；星座：${input.zodiac ?? '未知'}；兴趣标签：${(input.tags ?? []).join('、') || '无'}。`,
        '输出 JSON 数组，元素形如 {"nickname": "...", "description": "..."}，不要输出其他内容。',
      ].join('\n');
      const response = await fetch(`${this.opts.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.opts.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.9,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!response.ok) throw new Error(`LLM HTTP ${response.status}`);
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      let content = data.choices?.[0]?.message?.content ?? '';
      content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      const parsed: unknown = JSON.parse(content);
      if (!Array.isArray(parsed)) throw new Error('LLM output is not an array');
      const candidates = parsed
        .filter(
          (c): c is ProfileCandidate =>
            typeof c === 'object' &&
            c !== null &&
            typeof (c as Record<string, unknown>).nickname === 'string' &&
            typeof (c as Record<string, unknown>).description === 'string',
        )
        .slice(0, 6);
      if (candidates.length === 0) throw new Error('LLM output empty');
      return { candidates, source: 'llm' };
    } catch {
      return { candidates: FALLBACK_CANDIDATES, source: 'fallback' };
    }
  }
}
