/**
 * Simple HTTP client for the Ripple API.
 */
export async function apiGet(path, config) {
  const url = `${config.server}/api${path}`;
  const headers = {};
  if (config.token) {
    headers["Authorization"] = `Bearer ${config.token}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status} from ${path}`);
  }
  return res;
}

export async function apiJson(path, config) {
  const res = await apiGet(path, config);
  return res.json();
}

export async function apiBuffer(path, config) {
  const res = await apiGet(path, config);
  return Buffer.from(await res.arrayBuffer());
}
