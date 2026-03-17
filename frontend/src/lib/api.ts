const API_BASE = "/api";
const skillDetailCache = new Map<string, any>();
const skillDetailPending = new Map<string, Promise<any>>();

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ripple_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

// Auth
export const auth = {
  register: (email: string) =>
    request<{ access_token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  login: (email: string, password: string) =>
    request<{ access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<any>("/auth/me"),
};

// Users
export const users = {
  updateProfile: (data: any) =>
    request<any>("/users/me", { method: "PUT", body: JSON.stringify(data) }),
  generateProfile: (data: any) =>
    request<any>("/users/me/generate-profile", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  myLikes: () => request<any[]>("/users/me/likes"),
  myDownloads: () => request<any[]>("/users/me/downloads"),
  myRipples: () => request<any[]>("/users/me/ripples"),
};

// Skills
export const skills = {
  list: (params?: Record<string, string>) => {
    const query = params
      ? "?" + new URLSearchParams(params).toString()
      : "";
    return request<any>(`/skills${query}`);
  },
  get: async (slug: string) => {
    if (skillDetailCache.has(slug)) {
      return skillDetailCache.get(slug);
    }

    if (skillDetailPending.has(slug)) {
      return skillDetailPending.get(slug);
    }

    const pending = request<any>(`/skills/${slug}`)
      .then((data) => {
        skillDetailCache.set(slug, data);
        skillDetailPending.delete(slug);
        return data;
      })
      .catch((error) => {
        skillDetailPending.delete(slug);
        throw error;
      });

    skillDetailPending.set(slug, pending);
    return pending;
  },
  peek: (slug: string) => skillDetailCache.get(slug) ?? null,
  refresh: async (slug: string) => {
    skillDetailCache.delete(slug);
    skillDetailPending.delete(slug);
    return request<any>(`/skills/${slug}`).then((data) => {
      skillDetailCache.set(slug, data);
      return data;
    });
  },
  prefetch: async (slug: string) => {
    if (skillDetailCache.has(slug)) {
      return skillDetailCache.get(slug);
    }
    return skills.get(slug);
  },
  getFiles: (slug: string) => request<any[]>(`/skills/${slug}/files`),
  getFileContent: (slug: string, path: string) =>
    request<any>(`/skills/${slug}/files/${path}`),
  getVersions: (slug: string) => request<any[]>(`/skills/${slug}/versions`),
  download: (slug: string) =>
    request<any>(`/skills/${slug}/download`),
  upload: (formData: FormData) =>
    request<any>("/skills", { method: "POST", body: formData }),
  update: (slug: string, formData: FormData) =>
    request<any>(`/skills/${slug}`, { method: "PUT", body: formData }),
  updateStatus: (slug: string, status: string) =>
    request<any>(`/skills/${slug}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  comments: (slug: string) => request<any[]>(`/skills/${slug}/comments`),
  createComment: (slug: string, data: { content: string; parent_id?: string | null }) =>
    request<any>(`/skills/${slug}/comments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// Interactions
export const interactions = {
  copy: (slug: string) =>
    request<any>(`/skills/${slug}/copy`, { method: "POST" }),
  like: (slug: string) =>
    request<any>(`/skills/${slug}/like`, { method: "POST" }),
  unlike: (slug: string) =>
    request<any>(`/skills/${slug}/like`, { method: "DELETE" }),
  ripple: (slug: string, comment?: string) =>
    request<any>(`/skills/${slug}/ripple`, {
      method: "POST",
      body: JSON.stringify({ comment }),
    }),
  stats: (slug: string) => request<any>(`/skills/${slug}/stats`),
};

// Admin
export const admin = {
  users: (params?: Record<string, string>) => {
    const query = params
      ? "?" + new URLSearchParams(params).toString()
      : "";
    return request<any>(`/admin/users${query}`);
  },
  updateUserStatus: (id: string, status: string) =>
    request<any>(`/admin/users/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  skills: (params?: Record<string, string>) => {
    const query = params
      ? "?" + new URLSearchParams(params).toString()
      : "";
    return request<any>(`/admin/skills${query}`);
  },
  updateSkillStatus: (id: string, status: string) =>
    request<any>(`/admin/skills/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  stats: () => request<any>("/admin/stats"),
  topStats: () => request<any>("/admin/stats/top"),
};
