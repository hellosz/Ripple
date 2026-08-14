/**
 * HTTP client for the Ripple API.
 */

function authHeaders(token, extra = {}) {
  const h = { ...extra };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function ensure(res, path) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status} from ${path}`);
  }
  return res;
}

export async function apiGet(path, config) {
  const res = await fetch(`${config.server}/api${path}`, {
    headers: authHeaders(config.token),
  });
  return ensure(res, path);
}

export async function apiJson(path, config) {
  const res = await apiGet(path, config);
  return res.json();
}

export async function apiBuffer(path, config) {
  const res = await apiGet(path, config);
  return Buffer.from(await res.arrayBuffer());
}

export async function apiPost(path, body, config) {
  const res = await fetch(`${config.server}/api${path}`, {
    method: "POST",
    headers: authHeaders(config.token, { "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  return ensure(res, path);
}
