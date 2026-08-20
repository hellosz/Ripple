import { Redis } from 'ioredis';

export const DEVICE_CODE_TTL_SECONDS = 600;
const DEVICE_KEY = (code: string) => `ripple:device:${code}`;
const USER_CODE_KEY = (code: string) => `ripple:device:usercode:${code}`;
export const SSE_CHANNEL = (userId: string) => `ripple:sse:${userId}`;
export const SSE_PATTERN = 'ripple:sse:*';

export interface DeviceState {
  status: 'pending' | 'authorized';
  user_code: string;
  access_token?: string;
}

/** Redis 封装：不可用时静默降级（设备码返回错误、SSE 走本地投递） */
export class RedisService {
  private client: Redis | null = null;
  private subscriber: Redis | null = null;
  available = false;

  constructor(private readonly url: string) {}

  connect(): void {
    try {
      this.client = new Redis(this.url, {
        lazyConnect: false,
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => Math.min(times * 1000, 15000),
      });
      this.client.on('error', () => {
        this.available = false;
      });
      this.client.on('ready', () => {
        this.available = true;
      });
    } catch {
      this.client = null;
    }
  }

  async close(): Promise<void> {
    this.client?.disconnect();
    this.subscriber?.disconnect();
  }

  // ---- 设备码流程 ----

  async createDevice(deviceCode: string, userCode: string): Promise<boolean> {
    if (!this.client || !this.available) return false;
    const state: DeviceState = { status: 'pending', user_code: userCode };
    await this.client.set(DEVICE_KEY(deviceCode), JSON.stringify(state), 'EX', DEVICE_CODE_TTL_SECONDS);
    await this.client.set(USER_CODE_KEY(userCode), deviceCode, 'EX', DEVICE_CODE_TTL_SECONDS);
    return true;
  }

  async getDevice(deviceCode: string): Promise<DeviceState | null> {
    if (!this.client || !this.available) return null;
    const raw = await this.client.get(DEVICE_KEY(deviceCode));
    return raw ? (JSON.parse(raw) as DeviceState) : null;
  }

  async authorizeDevice(userCode: string, accessToken: string): Promise<boolean> {
    if (!this.client || !this.available) return false;
    const deviceCode = await this.client.get(USER_CODE_KEY(userCode));
    if (!deviceCode) return false;
    const raw = await this.client.get(DEVICE_KEY(deviceCode));
    if (!raw) return false;
    const state = JSON.parse(raw) as DeviceState;
    state.status = 'authorized';
    state.access_token = accessToken;
    const ttl = await this.client.ttl(DEVICE_KEY(deviceCode));
    await this.client.set(DEVICE_KEY(deviceCode), JSON.stringify(state), 'EX', Math.max(ttl, 60));
    return true;
  }

  /** authorized 状态一次性消费 */
  async consumeDevice(deviceCode: string): Promise<void> {
    if (!this.client || !this.available) return;
    const raw = await this.client.get(DEVICE_KEY(deviceCode));
    if (!raw) return;
    const state = JSON.parse(raw) as DeviceState;
    await this.client.del(DEVICE_KEY(deviceCode), USER_CODE_KEY(state.user_code));
  }

  // ---- SSE 跨实例 ----

  async publishSse(userId: string, payload: string): Promise<void> {
    if (!this.client || !this.available) return;
    try {
      await this.client.publish(SSE_CHANNEL(userId), payload);
    } catch {
      /* 降级：本地投递已完成 */
    }
  }

  subscribeSse(onMessage: (userId: string, payload: string) => void): void {
    try {
      this.subscriber = new Redis(this.url, {
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => Math.min(times * 1000, 15000),
      });
      this.subscriber.on('error', () => {
        /* 静默 */
      });
      void this.subscriber.psubscribe(SSE_PATTERN);
      this.subscriber.on('pmessage', (_pattern: string, channel: string, payload: string) => {
        const userId = channel.slice('ripple:sse:'.length);
        onMessage(userId, payload);
      });
    } catch {
      this.subscriber = null;
    }
  }

  // ---- 热度归一化基准缓存 ----

  async getCachedNumber(key: string): Promise<number | null> {
    if (!this.client || !this.available) return null;
    const raw = await this.client.get(key);
    return raw === null ? null : Number(raw);
  }

  async setCachedNumber(key: string, value: number, ttlSeconds: number): Promise<void> {
    if (!this.client || !this.available) return;
    await this.client.set(key, String(value), 'EX', ttlSeconds);
  }
}
