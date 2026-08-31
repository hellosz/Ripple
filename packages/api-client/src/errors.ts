export class RippleApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'RippleApiError';
    this.status = status;
    this.code = code;
  }
}

/** 归一化错误体：新服务端 {error:{code,message}}；旧 FastAPI {detail} */
export function normalizeError(status: number, body: unknown): RippleApiError {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    const err = record.error;
    if (err && typeof err === 'object') {
      const e = err as Record<string, unknown>;
      return new RippleApiError(
        status,
        typeof e.code === 'string' ? e.code : 'unknown',
        typeof e.message === 'string' ? e.message : `HTTP ${status}`,
      );
    }
    if (typeof record.detail === 'string') {
      return new RippleApiError(status, 'legacy', record.detail);
    }
  }
  return new RippleApiError(status, 'unknown', `HTTP ${status}`);
}
