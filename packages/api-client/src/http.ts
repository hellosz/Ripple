import type { z } from 'zod';
import {
  GUEST_SESSION_HEADER,
  adminSkillSchema,
  adminStatsSchema,
  adminUserSchema,
  collectionSchema,
  copyResponseSchema,
  cliVersionResponseSchema,
  createRippleResponseSchema,
  deviceInitResponseSchema,
  devicePollResponseSchema,
  fileContentSchema,
  fileTreeNodeSchema,
  followListResponseSchema,
  followResponseSchema,
  generateProfileResponseSchema,
  guestTouchResponseSchema,
  healthResponseSchema,
  likeResponseSchema,
  paginatedSchema,
  registerResponseSchema,
  rippleRecordSchema,
  skillCommentSchema,
  skillDetailSchema,
  skillListItemSchema,
  skillUploadResultSchema,
  skillVersionSchema,
  statsResponseSchema,
  tokenResponseSchema,
  topStatsSchema,
  userSchema,
  viewResponseSchema,
  type CreateCommentInput,
  type CreateRippleInput,
  type SkillListQuery,
  type UpdateProfileInput,
  type UpsertCollectionInput,
} from '@ripple/contract';
import { normalizeError } from './errors.js';

export interface ClientOptions {
  baseUrl: string;
  getToken?: () => string | null | Promise<string | null>;
  getGuestSession?: () => string | null;
  fetchImpl?: typeof fetch;
}

type Query = Record<string, string | number | boolean | undefined>;

interface RequestOptions {
  query?: Query;
  json?: unknown;
  formData?: FormData;
  raw?: boolean;
}

export class RippleClient {
  private readonly opts: ClientOptions;

  constructor(opts: ClientOptions) {
    this.opts = { ...opts, baseUrl: opts.baseUrl.replace(/\/$/, '') };
  }

  get baseUrl(): string {
    return this.opts.baseUrl;
  }

  buildUrl(path: string, query?: Query): string {
    const url = new URL(this.opts.baseUrl + path);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  private async headers(hasJson: boolean): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    if (hasJson) headers['Content-Type'] = 'application/json';
    const token = await this.opts.getToken?.();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const guest = this.opts.getGuestSession?.();
    if (guest) headers[GUEST_SESSION_HEADER] = guest;
    return headers;
  }

  async request<T>(
    method: string,
    path: string,
    schema: z.ZodType<T>,
    options: RequestOptions = {},
  ): Promise<T> {
    const fetchImpl = this.opts.fetchImpl ?? fetch;
    const response = await fetchImpl(this.buildUrl(path, options.query), {
      method,
      headers: await this.headers(options.json !== undefined),
      body:
        options.formData ?? (options.json !== undefined ? JSON.stringify(options.json) : undefined),
    });
    if (!response.ok) {
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        /* 非 JSON 错误体 */
      }
      throw normalizeError(response.status, body);
    }
    const data: unknown = await response.json();
    return schema.parse(data);
  }

  async requestBinary(path: string, query?: Query): Promise<ArrayBuffer> {
    const fetchImpl = this.opts.fetchImpl ?? fetch;
    const response = await fetchImpl(this.buildUrl(path, query), {
      headers: await this.headers(false),
    });
    if (!response.ok) {
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        /* ignore */
      }
      throw normalizeError(response.status, body);
    }
    return response.arrayBuffer();
  }

  // ---- auth ----
  readonly auth = {
    register: (email: string) =>
      this.request('POST', '/api/auth/register', registerResponseSchema, { json: { email } }),
    login: (email: string, password: string) =>
      this.request('POST', '/api/auth/login', tokenResponseSchema, { json: { email, password } }),
    me: () => this.request('GET', '/api/auth/me', userSchema),
    deviceInit: () => this.request('POST', '/api/auth/device/init', deviceInitResponseSchema),
    devicePoll: (deviceCode: string) =>
      this.request('GET', '/api/auth/device/poll', devicePollResponseSchema, {
        query: { device_code: deviceCode },
      }),
    deviceConfirm: (userCode: string) =>
      this.request('POST', '/api/auth/device/confirm', userSchema.pick({ id: true }).passthrough(), {
        json: { user_code: userCode },
      }),
  };

  // ---- users ----
  readonly users = {
    updateMe: (input: UpdateProfileInput) =>
      this.request('PUT', '/api/users/me', userSchema, { json: input }),
    generateProfile: () =>
      this.request('POST', '/api/users/me/generate-profile', generateProfileResponseSchema),
    myLikes: () => this.request('GET', '/api/users/me/likes', skillListItemSchema.array()),
    myDownloads: () => this.request('GET', '/api/users/me/downloads', skillListItemSchema.array()),
    myPublished: () => this.request('GET', '/api/users/me/skills', skillListItemSchema.array()),
    myRipples: () => this.request('GET', '/api/users/me/ripples', rippleRecordSchema.array()),
  };

  // ---- skills ----
  readonly skills = {
    list: (query: Partial<SkillListQuery> = {}) =>
      this.request('GET', '/api/skills', paginatedSchema(skillListItemSchema), {
        query: query as Query,
      }),
    get: (slug: string) => this.request('GET', `/api/skills/${slug}`, skillDetailSchema),
    files: (slug: string) =>
      this.request('GET', `/api/skills/${slug}/files`, fileTreeNodeSchema.array()),
    file: (slug: string, path: string) =>
      this.request('GET', `/api/skills/${slug}/files/${encodeURI(path)}`, fileContentSchema),
    versions: (slug: string) =>
      this.request('GET', `/api/skills/${slug}/versions`, skillVersionSchema.array()),
    downloadUrl: (slug: string) => this.buildUrl(`/api/skills/${slug}/download`),
    download: (slug: string) => this.requestBinary(`/api/skills/${slug}/download`),
    upload: (formData: FormData) =>
      this.request('POST', '/api/skills', skillUploadResultSchema, { formData }),
    update: (slug: string, formData: FormData) =>
      this.request('PUT', `/api/skills/${slug}`, skillUploadResultSchema, { formData }),
    setStatus: (slug: string, status: string) =>
      this.request('PATCH', `/api/skills/${slug}/status`, skillDetailSchema, {
        json: { status },
      }),
    comments: (slug: string) =>
      this.request('GET', `/api/skills/${slug}/comments`, skillCommentSchema.array()),
    addComment: (slug: string, input: CreateCommentInput) =>
      this.request('POST', `/api/skills/${slug}/comments`, skillCommentSchema, { json: input }),
    heatRank: (limit = 5) =>
      this.request('GET', '/api/skills/rank/heat', skillListItemSchema.array(), {
        query: { limit },
      }),
  };

  // ---- interactions ----
  readonly interactions = {
    copy: (slug: string) => this.request('POST', `/api/skills/${slug}/copy`, copyResponseSchema),
    like: (slug: string) => this.request('POST', `/api/skills/${slug}/like`, likeResponseSchema),
    unlike: (slug: string) =>
      this.request('DELETE', `/api/skills/${slug}/like`, likeResponseSchema),
    ripple: (slug: string, input: CreateRippleInput = {}) =>
      this.request('POST', `/api/skills/${slug}/ripple`, createRippleResponseSchema, {
        json: input,
      }),
    stats: (slug: string) => this.request('GET', `/api/skills/${slug}/stats`, statsResponseSchema),
    view: (slug: string) => this.request('POST', `/api/skills/${slug}/view`, viewResponseSchema),
  };

  // ---- ripples ----
  readonly ripples = {
    guestTouch: () =>
      this.request('POST', '/api/ripples/guest-session/touch', guestTouchResponseSchema),
    consume: (deliveryId: string) =>
      this.request(
        'POST',
        `/api/ripples/deliveries/${deliveryId}/consume`,
        guestTouchResponseSchema.partial().passthrough(),
      ),
    dismiss: (deliveryId: string) =>
      this.request(
        'POST',
        `/api/ripples/deliveries/${deliveryId}/dismiss`,
        guestTouchResponseSchema.partial().passthrough(),
      ),
  };

  // ---- collections ----
  readonly collections = {
    list: () => this.request('GET', '/api/collections', collectionSchema.array()),
    get: (slug: string) => this.request('GET', `/api/collections/${slug}`, collectionSchema),
    upsert: (input: UpsertCollectionInput) =>
      this.request('POST', '/api/collections', collectionSchema, { json: input }),
    remove: (slug: string) =>
      this.request(
        'DELETE',
        `/api/collections/${slug}`,
        collectionSchema.pick({ id: true }).passthrough(),
      ),
  };

  // ---- follows ----
  readonly follows = {
    follow: (userId: string) =>
      this.request('POST', `/api/users/${userId}/follow`, followResponseSchema),
    unfollow: (userId: string) =>
      this.request('DELETE', `/api/users/${userId}/follow`, followResponseSchema),
    myFollowing: () => this.request('GET', '/api/users/me/following', followListResponseSchema),
  };

  // ---- admin ----
  readonly admin = {
    users: (query: Query = {}) =>
      this.request('GET', '/api/admin/users', paginatedSchema(adminUserSchema), { query }),
    setUserStatus: (userId: string, status: 'active' | 'disabled') =>
      this.request('PATCH', `/api/admin/users/${userId}/status`, adminUserSchema, {
        json: { status },
      }),
    skills: (query: Query = {}) =>
      this.request('GET', '/api/admin/skills', paginatedSchema(adminSkillSchema), { query }),
    setSkillStatus: (skillId: string, status: string) =>
      this.request('PATCH', `/api/admin/skills/${skillId}/status`, adminSkillSchema, {
        json: { status },
      }),
    stats: () => this.request('GET', '/api/admin/stats', adminStatsSchema),
    topStats: () => this.request('GET', '/api/admin/stats/top', topStatsSchema),
  };

  // ---- meta ----
  readonly meta = {
    health: () => this.request('GET', '/api/health', healthResponseSchema),
    cliVersion: () => this.request('GET', '/api/cli/version', cliVersionResponseSchema),
  };
}
