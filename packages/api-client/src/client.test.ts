import { describe, expect, it, vi } from 'vitest';
import { RippleClient } from './http.js';
import { RippleApiError, normalizeError } from './errors.js';
import { parseSseChunk } from './sse.js';

function mockFetch(status: number, body: unknown): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

const HEALTH = { status: 'ok', version: '1.0.0', sse_connections: 0 };

describe('RippleClient', () => {
  it('注入 Bearer token 与游客会话头', async () => {
    const fetchImpl = mockFetch(200, HEALTH);
    const client = new RippleClient({
      baseUrl: 'http://api.test',
      getToken: () => 'tok-123',
      getGuestSession: () => 'guest-session-1',
      fetchImpl,
    });
    await client.meta.health();
    const call = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(call[0]).toBe('http://api.test/api/health');
    const headers = call[1].headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer tok-123');
    expect(headers['X-Ripple-Guest-Session']).toBe('guest-session-1');
  });

  it('query 参数序列化并跳过 undefined', () => {
    const client = new RippleClient({ baseUrl: 'http://api.test' });
    const url = client.buildUrl('/api/skills', { search: 'git', page: 2, tags: undefined });
    expect(url).toBe('http://api.test/api/skills?search=git&page=2');
  });

  it('响应 schema 校验失败抛错', async () => {
    const client = new RippleClient({
      baseUrl: 'http://api.test',
      fetchImpl: mockFetch(200, { status: 'ok' }),
    });
    await expect(client.meta.health()).rejects.toThrow();
  });

  it('新错误体 {error:{code,message}} 归一化', async () => {
    const client = new RippleClient({
      baseUrl: 'http://api.test',
      fetchImpl: mockFetch(403, { error: { code: 'forbidden', message: '无权限' } }),
    });
    const err = await client.meta.health().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RippleApiError);
    expect((err as RippleApiError).code).toBe('forbidden');
    expect((err as RippleApiError).status).toBe(403);
    expect((err as RippleApiError).message).toBe('无权限');
  });

  it('旧 FastAPI {detail} 错误体兼容', () => {
    const err = normalizeError(400, { detail: 'Already liked' });
    expect(err.code).toBe('legacy');
    expect(err.message).toBe('Already liked');
  });

  it('非 JSON 错误体降级为 HTTP 状态', () => {
    const err = normalizeError(502, null);
    expect(err.message).toBe('HTTP 502');
  });
});

describe('parseSseChunk', () => {
  it('解析完整事件并保留半截缓冲', () => {
    const { events, rest } = parseSseChunk(
      'data: {"a":1}\n\ndata: {"b":2}\n\ndata: {"partial"',
    );
    expect(events).toEqual(['{"a":1}', '{"b":2}']);
    expect(rest).toBe('data: {"partial"');
  });

  it('忽略心跳注释行', () => {
    const { events } = parseSseChunk(': heartbeat\n\ndata: {"x":1}\n\n');
    expect(events).toEqual(['{"x":1}']);
  });

  it('多行 data 合并', () => {
    const { events } = parseSseChunk('data: line1\ndata: line2\n\n');
    expect(events).toEqual(['line1\nline2']);
  });

  it('CRLF 兼容', () => {
    const { events } = parseSseChunk('data: {"y":2}\r\n\r\n');
    expect(events).toEqual(['{"y":2}']);
  });
});
