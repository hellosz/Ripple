import { notificationSchema, type Notification } from '@ripple/contract';

export type NotificationHandler = (notification: Notification) => void;

export interface SseOptions {
  baseUrl: string;
  getToken: () => string | null;
  /** 断线重连间隔（毫秒），默认 5000 */
  reconnectDelayMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * 解析 SSE 字节流的一段增量，返回完整事件的 data 载荷列表与剩余缓冲。
 * 心跳注释行（以 ':' 开头）被忽略。
 */
export function parseSseChunk(buffer: string): { events: string[]; rest: string } {
  const events: string[] = [];
  const normalized = buffer.replace(/\r\n/g, '\n');
  const blocks = normalized.split('\n\n');
  const rest = blocks.pop() ?? '';
  for (const block of blocks) {
    const dataLines = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart());
    if (dataLines.length > 0) events.push(dataLines.join('\n'));
  }
  return { events, rest };
}

/** SSE 通知客户端：fetch 流式读取（浏览器/Node 通用），断线自动重连，订阅者模式 */
export class SseNotificationClient {
  private readonly opts: Required<Pick<SseOptions, 'baseUrl' | 'getToken'>> & SseOptions;
  private handlers = new Set<NotificationHandler>();
  private abort: AbortController | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = true;

  constructor(opts: SseOptions) {
    this.opts = { reconnectDelayMs: 5000, ...opts };
  }

  onNotification(handler: NotificationHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  get connected(): boolean {
    return this.abort !== null;
  }

  connect(): void {
    if (!this.closed) return;
    this.closed = false;
    void this.loop();
  }

  close(): void {
    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.abort?.abort();
    this.abort = null;
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    this.reconnectTimer = setTimeout(() => void this.loop(), this.opts.reconnectDelayMs);
  }

  private dispatch(payload: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return;
    }
    const result = notificationSchema.safeParse(parsed);
    if (!result.success) return;
    for (const handler of this.handlers) handler(result.data);
  }

  private async loop(): Promise<void> {
    const token = this.opts.getToken();
    if (!token) {
      this.scheduleReconnect();
      return;
    }
    const fetchImpl = this.opts.fetchImpl ?? fetch;
    this.abort = new AbortController();
    try {
      const url = `${this.opts.baseUrl.replace(/\/$/, '')}/api/sse/notifications?token=${encodeURIComponent(token)}`;
      const response = await fetchImpl(url, {
        headers: { Accept: 'text/event-stream' },
        signal: this.abort.signal,
      });
      if (!response.ok || !response.body) throw new Error(`SSE HTTP ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, rest } = parseSseChunk(buffer);
        buffer = rest;
        for (const event of events) this.dispatch(event);
      }
    } catch {
      /* 断线 → 重连 */
    } finally {
      this.abort = null;
      this.scheduleReconnect();
    }
  }
}
