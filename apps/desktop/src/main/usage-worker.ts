/**
 * 使用扫描子进程入口（ELECTRON_RUN_AS_NODE 下的纯 Node 运行时）。
 * 背景：node:sqlite 与原生 zstd 等能力在 Electron 主进程存在非确定性 SIGTRAP
 * （V8 内存沙箱环境实测时崩时不崩），且全量扫描是 CPU/IO 重活不应占 UI 进程——
 * 因此 scanAll 整体在本子进程执行，主进程只拿汇总结果。
 * 协议：argv[2] 为 JSON 配置 {homeDir, usageDir?, knownSkills[], settings}；
 * 结果以单行 JSON 写 stdout（RESULT: 前缀），错误走 stderr + 非零退出码。
 */
import { UsageCollector } from '@ripple/hub';

interface WorkerConfig {
  homeDir: string;
  usageDir?: string;
  knownSkills: string[];
  settings: { enabled: boolean; agents: Record<string, boolean> };
}

async function main(): Promise<void> {
  const raw = process.argv[2];
  if (!raw) throw new Error('missing config argv');
  const config = JSON.parse(raw) as WorkerConfig;
  const collector = new UsageCollector({
    homeDir: config.homeDir,
    ...(config.usageDir ? { usageDir: config.usageDir } : {}),
    knownSkills: () => config.knownSkills,
    settings: () => config.settings,
  });
  const summary = await collector.scanAll();
  process.stdout.write(`RESULT:${JSON.stringify(summary)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`usage-worker failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
