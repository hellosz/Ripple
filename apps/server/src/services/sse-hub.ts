import type { Notification } from '@ripple/contract';
import type { RedisService } from './redis.js';

type Sender = (payload: string) => void;

/**
 * SSE 连接中心：进程内 userId → 发送函数集合；
 * 跨实例经 Redis pub/sub（不可用时仅本地投递）。
 */
export class SseHub {
  private connections = new Map<string, Set<Sender>>();

  constructor(private readonly redis: RedisService) {}

  startSubscriber(): void {
    this.redis.subscribeSse((userId, payload) => this.deliverLocal(userId, payload));
  }

  register(userId: string, sender: Sender): () => void {
    let set = this.connections.get(userId);
    if (!set) {
      set = new Set();
      this.connections.set(userId, set);
    }
    set.add(sender);
    return () => {
      set.delete(sender);
      if (set.size === 0) this.connections.delete(userId);
    };
  }

  isUserOnline(userId: string): boolean {
    return this.connections.has(userId);
  }

  get connectionCount(): number {
    let n = 0;
    for (const set of this.connections.values()) n += set.size;
    return n;
  }

  private deliverLocal(userId: string, payload: string): boolean {
    const set = this.connections.get(userId);
    if (!set || set.size === 0) return false;
    for (const sender of set) sender(payload);
    return true;
  }

  /** 通知用户：本地直投 + Redis 广播（其他实例）。返回本地是否命中在线连接 */
  async notify(userId: string, notification: Notification): Promise<boolean> {
    const payload = JSON.stringify(notification);
    const deliveredLocally = this.deliverLocal(userId, payload);
    await this.redis.publishSse(userId, payload);
    return deliveredLocally;
  }
}
