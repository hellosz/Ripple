import { execFileSync } from "node:child_process";
import { apiJson, apiPost } from "./api.mjs";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function openUrl(url) {
  const platform = process.platform;
  try {
    if (platform === "darwin") execFileSync("open", [url]);
    else if (platform === "win32") execFileSync("cmd", ["/c", "start", "", url]);
    else execFileSync("xdg-open", [url]);
  } catch {
    console.log(`无法自动打开浏览器，请手动打开: ${url}`);
  }
}

/**
 * Device Authorization Flow login.
 * 本机模式：自动打开浏览器，轮询回传。
 * 远程模式：打印链接 + 验证码，轮询探测。
 */
export async function deviceLogin(server, { remote = false } = {}) {
  const res = await apiPost("/auth/device/init", {}, { server, token: "" });
  const data = await res.json();

  if (remote) {
    console.log(`\n请在浏览器打开: ${data.verification_url}`);
    console.log(`验证码: ${data.user_code}\n`);
  } else {
    console.log(`\n→ 正在打开浏览器授权 ...`);
    console.log(`验证码: ${data.user_code}\n`);
    openUrl(data.verification_url);
  }

  const deadline = Date.now() + data.expires_in * 1000;
  while (Date.now() < deadline) {
    await sleep((data.interval || 2) * 1000);
    const poll = await apiJson(
      `/auth/device/poll?device_code=${encodeURIComponent(data.device_code)}`,
      { server, token: "" }
    );
    if (poll.status === "authorized") {
      return poll.access_token;
    }
  }
  throw new Error("授权超时，请重新运行 login");
}

export async function whoami(config) {
  return apiJson("/auth/me", config);
}
