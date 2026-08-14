import { apiJson } from "./api.mjs";

export async function list(config, query = "") {
  const q = query ? `?search=${encodeURIComponent(query)}` : "";
  return apiJson(`/skills${q}`, config);
}

export async function info(name, config) {
  return apiJson(`/skills/${name}`, config);
}
