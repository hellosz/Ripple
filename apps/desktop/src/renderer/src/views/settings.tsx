import { useEffect, useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import type { RepoSkill } from '@ripple/hub';
import type { AiProvider } from '../../../shared/api.js';
import { AgentIcon } from '../agent-icons.js';
import { ripple } from '../ripple-api.js';
import { errText, useStore } from '../store.js';
import {
  DANGER,
  GREEN_DEEP,
  INK,
  MONO,
  PRIMARY,
  chipStyle,
  dim,
  fmtBytes,
  fmtTime,
  gradBtn,
  inputStyle,
  outlineBtn,
} from '../ui.js';

const panelStyle: CSSProperties = {
  border: '1px solid rgba(63,68,56,.09)',
  borderRadius: 13,
  background: '#ffffff',
  padding: '18px 20px',
};

const segStyle = (on: boolean): CSSProperties => ({
  ...chipStyle(on),
  background: on ? 'rgba(147,168,107,.14)' : undefined,
});

const DEMO_DEEPLINK = 'ripple://install?skill=git-archaeologist';

function SourcesTab(): ReactElement {
  const store = useStore();
  const { snapshot } = store;
  const settings = snapshot?.settings;
  const sources = snapshot?.sources ?? [];
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [browse, setBrowse] = useState<{ id: string; label: string } | null>(null);

  const setLocation = (loc: 'builtin' | 'shared'): void => {
    if (settings?.storage_location === loc) return;
    store.run(async () => {
      await ripple.setStorageLocation(loc);
      await store.refresh();
      store.toast(
        loc === 'builtin'
          ? '中心存储：~/.ripple/skills/（已平滑迁移，状态不丢失）'
          : '中心存储：~/.agents/skills/（社区共享约定，已平滑迁移）',
      );
    });
  };

  const setDist = (mode: 'symlink' | 'copy'): void => {
    if (settings?.dist_mode === mode) return;
    store.run(async () => {
      await ripple.setDistMode(mode);
      await store.refresh();
      store.toast(
        mode === 'symlink' ? '分发方式已切换为 symlink（各 Agent 目录指向中心存储）' : '分发方式已切换为文件复制',
      );
    });
  };

  const addRepo = (): void => {
    const spec = draft.trim();
    if (!spec) {
      store.toast('请填写仓库地址');
      return;
    }
    store.run(async () => {
      const repo = await ripple.addSource(spec);
      setFormOpen(false);
      setDraft('');
      await store.refresh();
      store.toast(`已添加仓库 ${repo.owner}/${repo.repo}`);
    });
  };

  const removeRepo = (id: string, label: string): void => {
    store.run(async () => {
      await ripple.removeSource(id);
      await store.refresh();
      store.toast(`已移除仓库 ${label}（已装技能保留，不再更新）`);
    });
  };

  const importZip = (): void => {
    store.run(async () => {
      const agent = settings?.default_agent ?? 'claude-code';
      const records = await ripple.importZipDialog([{ agent }]);
      if (!records) return;
      await store.refresh();
      const name = records[0]?.skill;
      store.toast(name ? `已导入「${name}」到中心存储并安装` : '已导入 ZIP');
    });
  };

  const copyDeepLink = (): void => {
    void navigator.clipboard
      .writeText(DEMO_DEEPLINK)
      .then(() => store.toast('示例 Deep Link 已复制'))
      .catch(() => store.toast('复制失败'));
  };

  const distTargets = (snapshot?.agents ?? [])
    .filter((a) => a.detected)
    .slice(0, 2)
    .map((a) => `~/${a.globalRelPath}/`);
  const distLine = `${settings?.storage_dir ?? '~/.ripple/skills'} → ${
    distTargets.length ? distTargets.join(' · ') : '~/.claude/skills/ · ~/.codex/skills/'
  } · 项目/.claude/skills/ …`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 860 }}>
      {/* 中心存储与分发 */}
      <div style={panelStyle}>
        <div style={{ fontWeight: 900, fontSize: 14, color: INK, marginBottom: 4 }}>中心存储与分发</div>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: dim(0.55), lineHeight: 1.7 }}>
          所有技能统一存放在中心目录（SSOT），再分发到各 Agent 与项目目录；切换位置会平滑迁移，状态不丢失。
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: 12.5 }}>
          <span style={{ width: 70, color: dim(0.5), flex: 'none' }}>存储位置</span>
          <span className="rp-chip" onClick={() => setLocation('builtin')} style={segStyle(settings?.storage_location === 'builtin')}>
            内置 ~/.ripple/skills
          </span>
          <span className="rp-chip" onClick={() => setLocation('shared')} style={segStyle(settings?.storage_location === 'shared')}>
            共享 ~/.agents/skills
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
          <span style={{ width: 70, color: dim(0.5), flex: 'none' }}>分发方式</span>
          <span className="rp-chip" onClick={() => setDist('symlink')} style={segStyle(settings?.dist_mode === 'symlink')}>
            symlink（推荐）
          </span>
          <span className="rp-chip" onClick={() => setDist('copy')} style={segStyle(settings?.dist_mode === 'copy')}>
            文件复制
          </span>
        </div>
        <div style={{ marginTop: 12, fontFamily: MONO, fontSize: 11.5, color: dim(0.45) }}>{distLine}</div>
      </div>

      {/* 技能仓库（GitHub / GitLab） */}
      <div style={panelStyle}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontWeight: 900, fontSize: 14, color: INK }}>技能仓库</span>
          <span style={{ flex: 1 }} />
          <span
            className="rp-btn-outline"
            onClick={() => setFormOpen((o) => !o)}
            style={{ ...outlineBtn, fontSize: 12, padding: '6px 14px' }}
          >
            ＋ 添加仓库
          </span>
        </div>
        <p style={{ margin: '0 0 10px', fontSize: 12, color: dim(0.55), lineHeight: 1.7 }}>
          本地模式也可用：从仓库扫描并安装技能。支持 GitHub <code>owner/repo[#branch][:subdir]</code>
          ，或私服 GitLab public 仓库完整 URL <code>https://host/owner/repo[#branch][:subdir]</code>。
        </p>
        {formOpen && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, animation: 'fade-in .2s ease-out' }}>
            <input
              className="rp-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addRepo();
              }}
              placeholder="anthropics/skills#main 或 https://gitlab.example.com/team/skills:skills"
              style={{ ...inputStyle, flex: 1, minWidth: 0 }}
            />
            <span className="rp-btn-grad" onClick={addRepo} style={{ ...gradBtn, fontSize: 12.5, padding: '8px 18px' }}>
              添加
            </span>
          </div>
        )}
        {sources.map((rp) => {
          const label =
            `${rp.host ? `${rp.host}/` : ''}${rp.owner}/${rp.repo}` + (rp.subdir ? ` › ${rp.subdir}` : '');
          return (
            <div
              key={rp.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 0',
                borderTop: '1px dashed rgba(63,68,56,.08)',
                fontSize: 12.5,
              }}
            >
              <span style={{ fontFamily: MONO, fontWeight: 700, color: INK, whiteSpace: 'nowrap' }}>{label}</span>
              <span
                style={{
                  fontSize: 10.5,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'rgba(147,168,107,.1)',
                  color: PRIMARY,
                  whiteSpace: 'nowrap',
                  fontFamily: MONO,
                }}
              >
                {rp.branch}
              </span>
              <span style={{ flex: 1, color: dim(0.45), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {rp.note}
              </span>
              <span
                className="rp-btn-outline"
                onClick={() => setBrowse({ id: rp.id, label })}
                style={{ ...outlineBtn, fontSize: 11.5, padding: '5px 12px', flex: 'none' }}
              >
                浏览技能
              </span>
              {!rp.builtin && (
                <span
                  className="rp-hover-danger"
                  onClick={() => removeRepo(rp.id, `${rp.owner}/${rp.repo}`)}
                  style={{ color: 'rgba(75,80,64,.35)', cursor: 'pointer', padding: '2px 6px', borderRadius: 5 }}
                >
                  移除
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ZIP 导入 + Deep Link */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={panelStyle}>
          <div style={{ fontWeight: 900, fontSize: 14, color: INK, marginBottom: 4 }}>ZIP 导入</div>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: dim(0.55), lineHeight: 1.7 }}>
            离线安装：选择包含 SKILL.md 的 ZIP 包，解压校验后进入中心存储。
          </p>
          <span
            className="rp-btn-outline"
            onClick={importZip}
            style={{ ...outlineBtn, display: 'inline-block', fontSize: 12.5, padding: '8px 18px' }}
          >
            选择 ZIP 文件…
          </span>
        </div>
        <div style={panelStyle}>
          <div style={{ fontWeight: 900, fontSize: 14, color: INK, marginBottom: 4 }}>Deep Link 导入</div>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: dim(0.55), lineHeight: 1.7 }}>
            网页端"安装"可直接唤起客户端完成安装。
          </p>
          <div
            className="rp-chip"
            onClick={copyDeepLink}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(63,68,56,.04)',
              border: '1px solid rgba(63,68,56,.08)',
              borderRadius: 8,
              padding: '8px 12px',
              fontFamily: MONO,
              fontSize: 11.5,
              color: PRIMARY,
              cursor: 'pointer',
            }}
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {DEMO_DEEPLINK}
            </span>
            <span style={{ fontSize: 11, color: dim(0.45), whiteSpace: 'nowrap', fontFamily: "'Noto Sans SC',sans-serif" }}>
              复制
            </span>
          </div>
        </div>
      </div>

      {browse && <RepoBrowseModal sourceId={browse.id} label={browse.label} onClose={() => setBrowse(null)} />}
    </div>
  );
}

/** 「浏览技能」弹窗：列出来源仓库内技能并可安装到默认 Agent */
function RepoBrowseModal({
  sourceId,
  label,
  onClose,
}: {
  sourceId: string;
  label: string;
  onClose: () => void;
}): ReactElement {
  const store = useStore();
  const defaultAgent = store.snapshot?.settings.default_agent ?? 'claude-code';
  const agentName =
    store.snapshot?.agents.find((a) => a.id === defaultAgent)?.name ?? defaultAgent;
  const [skills, setSkills] = useState<RepoSkill[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState<Record<string, boolean>>({});
  const [installed, setInstalled] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    setSkills(null);
    setError(null);
    ripple
      .listRepoSkills(sourceId)
      .then((list) => {
        if (alive) setSkills(list);
      })
      .catch((err: unknown) => {
        if (alive) setError(errText(err));
      });
    return () => {
      alive = false;
    };
  }, [sourceId]);

  const install = (name: string): void => {
    if (installing[name]) return;
    setInstalling((m) => ({ ...m, [name]: true }));
    void (async () => {
      try {
        await ripple.installFromRepo(sourceId, name, [{ agent: defaultAgent }]);
        await store.refresh();
        setInstalled((m) => ({ ...m, [name]: true }));
        store.toast(`已从仓库安装「${name}」到 ${agentName}`);
      } catch (err) {
        store.toast(`安装失败：${errText(err)}`);
      } finally {
        setInstalling((m) => ({ ...m, [name]: false }));
      }
    })();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(63,68,56,.35)',
        backdropFilter: 'blur(6px)',
        animation: 'fade-in .2s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520,
          maxHeight: '72vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          borderRadius: 16,
          padding: '22px 24px',
          boxShadow: '0 20px 50px rgba(63,68,56,.2)',
          animation: 'slide-up .25s cubic-bezier(.16,1,.3,1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 900, fontSize: 15, color: INK }}>浏览技能</span>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 11.5,
              color: dim(0.45),
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
              flex: 1,
            }}
          >
            {label}
          </span>
          <span
            className="rp-hover-primary"
            onClick={onClose}
            style={{ color: dim(0.4), cursor: 'pointer', fontSize: 14, flex: 'none', padding: '0 2px' }}
          >
            ✕
          </span>
        </div>
        <p style={{ margin: '6px 0 12px', fontSize: 12, color: dim(0.5) }}>
          点「安装」进入中心存储并安装到默认 Agent（{agentName}）。
        </p>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {skills === null && error === null && (
            <div style={{ textAlign: 'center', padding: '36px 0', color: dim(0.45), fontSize: 12.5 }}>
              正在扫描仓库…
            </div>
          )}
          {error !== null && (
            <div style={{ textAlign: 'center', padding: '36px 0', color: DANGER, fontSize: 12.5 }}>
              加载失败：{error}
            </div>
          )}
          {skills !== null && skills.length === 0 && (
            <div style={{ textAlign: 'center', padding: '36px 0', color: dim(0.45), fontSize: 12.5 }}>
              此仓库内未发现技能（缺少 SKILL.md）
            </div>
          )}
          {(skills ?? []).map((s) => (
            <div
              key={s.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 0',
                borderBottom: '1px dashed rgba(63,68,56,.08)',
                fontSize: 12.5,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ fontWeight: 700, color: INK, whiteSpace: 'nowrap' }}>{s.name}</span>
                <span style={{ fontFamily: "'Space Grotesk',sans-serif", color: PRIMARY, marginLeft: 8 }}>
                  v{s.version}
                </span>
                <div
                  style={{
                    fontSize: 11.5,
                    color: dim(0.45),
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.description}
                </div>
              </div>
              {installed[s.name] ? (
                <span style={{ fontSize: 12, color: GREEN_DEEP, fontWeight: 700, flex: 'none' }}>✓ 已安装</span>
              ) : (
                <span
                  className="rp-btn-outline"
                  onClick={() => install(s.name)}
                  style={{
                    ...outlineBtn,
                    fontSize: 11.5,
                    padding: '5px 14px',
                    flex: 'none',
                    opacity: installing[s.name] ? 0.5 : undefined,
                  }}
                >
                  {installing[s.name] ? '安装中…' : '安装'}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 各服务商的推荐默认值（切换时预填，可修改；custom 需手填） */
const AI_PROVIDER_DEFAULTS: Record<AiProvider, { baseUrl: string; model: string }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  custom: { baseUrl: '', model: '' },
};

const AI_PROVIDER_NAMES: Record<AiProvider, string> = {
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  custom: '自定义',
};

const aiFieldRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: 12.5 };
const aiLabel: CSSProperties = { width: 70, color: dim(0.5), flex: 'none' };

/** 「AI 服务商」tab：多服务商配置（baseUrl/model/apiKey）+ 连接测试 */
function AiTab(): ReactElement {
  const store = useStore();
  const [loaded, setLoaded] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [provider, setProvider] = useState<AiProvider>('openai');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  /** 已保存配置的服务商与字段（切回该服务商时恢复保存值而非默认值） */
  const [savedCfg, setSavedCfg] = useState<{ provider: AiProvider; baseUrl: string; model: string } | null>(null);

  useEffect(() => {
    let alive = true;
    ripple
      .aiGetConfig()
      .then((cfg) => {
        if (!alive) return;
        setProvider(cfg.provider);
        setBaseUrl(cfg.baseUrl);
        setModel(cfg.model);
        setHasKey(cfg.hasKey);
        setSavedCfg({ provider: cfg.provider, baseUrl: cfg.baseUrl, model: cfg.model });
        setLoaded(true);
      })
      .catch((err: unknown) => {
        if (alive) store.toast(`读取 AI 配置失败：${errText(err)}`);
      });
    return () => {
      alive = false;
    };
    // 仅挂载时读取一次
  }, []);

  const pickProvider = (p: AiProvider): void => {
    setProvider(p);
    // 已保存配置的服务商 → 恢复保存值；否则预填该服务商默认值（custom 留空手填）
    if (savedCfg && savedCfg.provider === p) {
      setBaseUrl(savedCfg.baseUrl);
      setModel(savedCfg.model);
    } else {
      setBaseUrl(AI_PROVIDER_DEFAULTS[p].baseUrl);
      setModel(AI_PROVIDER_DEFAULTS[p].model);
    }
  };

  const save = (): void => {
    if (saving) return;
    if (provider === 'custom' && (!baseUrl.trim() || !model.trim())) {
      store.toast('自定义服务商需填写 Base URL 与模型名');
      return;
    }
    setSaving(true);
    void (async () => {
      try {
        const key = apiKey.trim();
        const cfg = await ripple.aiSetConfig({
          provider,
          baseUrl: baseUrl.trim() || undefined,
          model: model.trim() || undefined,
          ...(key ? { apiKey: key } : {}),
        });
        setProvider(cfg.provider);
        setBaseUrl(cfg.baseUrl);
        setModel(cfg.model);
        setHasKey(cfg.hasKey);
        setSavedCfg({ provider: cfg.provider, baseUrl: cfg.baseUrl, model: cfg.model });
        setApiKey('');
        store.toast(`已保存 AI 配置（${AI_PROVIDER_NAMES[cfg.provider]} · ${cfg.model}）`);
      } catch (err) {
        store.toast(`保存失败：${errText(err)}`);
      } finally {
        setSaving(false);
      }
    })();
  };

  const test = (): void => {
    if (testing) return;
    setTesting(true);
    void (async () => {
      try {
        const r = await ripple.aiTest();
        store.toast(r.ok ? `连接成功：${r.message}` : `连接失败：${r.message}`);
      } catch (err) {
        store.toast(`连接失败：${errText(err)}`);
      } finally {
        setTesting(false);
      }
    })();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 860 }}>
      <div style={panelStyle}>
        <div style={{ fontWeight: 900, fontSize: 14, color: INK, marginBottom: 4 }}>AI 服务商</div>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: dim(0.55), lineHeight: 1.7 }}>
          用于技能「评分」与「优化」。支持 OpenAI、DeepSeek 或任意 OpenAI 兼容服务（自定义 Base URL / 模型）。
        </p>
        <div style={aiFieldRow}>
          <span style={aiLabel}>服务商</span>
          {(['openai', 'deepseek', 'custom'] as const).map((p) => (
            <span key={p} className="rp-chip" onClick={() => pickProvider(p)} style={segStyle(provider === p)}>
              {AI_PROVIDER_NAMES[p]}
            </span>
          ))}
        </div>
        <div style={aiFieldRow}>
          <span style={aiLabel}>Base URL</span>
          <input
            className="rp-input"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={provider === 'custom' ? 'https://your-host/v1（必填）' : AI_PROVIDER_DEFAULTS[provider].baseUrl}
            style={{ ...inputStyle, flex: 1, minWidth: 0 }}
          />
        </div>
        <div style={aiFieldRow}>
          <span style={aiLabel}>模型</span>
          <input
            className="rp-input"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={provider === 'custom' ? '模型名（必填）' : AI_PROVIDER_DEFAULTS[provider].model}
            style={{ ...inputStyle, flex: 1, minWidth: 0 }}
          />
        </div>
        <div style={aiFieldRow}>
          <span style={aiLabel}>API Key</span>
          <input
            className="rp-input"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={hasKey ? '已保存（留空不改，输入新值覆盖）' : 'sk-…'}
            style={{ ...inputStyle, flex: 1, minWidth: 0 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
          <span
            className="rp-btn-grad"
            onClick={save}
            style={{ ...gradBtn, fontSize: 12.5, padding: '8px 18px', opacity: saving || !loaded ? 0.6 : undefined }}
          >
            {saving ? '保存中…' : '保存'}
          </span>
          <span
            className="rp-btn-outline"
            onClick={test}
            style={{ ...outlineBtn, fontSize: 12.5, padding: '8px 18px', opacity: testing ? 0.6 : undefined }}
          >
            {testing ? '测试中…' : '测试连接'}
          </span>
          {hasKey && (
            <span style={{ fontSize: 11.5, color: GREEN_DEEP, fontWeight: 700 }}>✓ API Key 已配置</span>
          )}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          border: '1px solid rgba(127,165,136,.25)',
          background: 'rgba(127,165,136,.05)',
          borderRadius: 11,
          padding: '10px 16px',
          fontSize: 12,
          color: GREEN_DEEP,
        }}
      >
        ✓ API Key 经系统安全存储（safeStorage）加密保存，仅在本机主进程使用，不上传服务器
      </div>
    </div>
  );
}

/** 按 Agent 批量备份：已检测 Agent 多选 + 全选 */
function AgentBackupPanel(): ReactElement | null {
  const store = useStore();
  const agents = (store.snapshot?.agents ?? []).filter((a) => a.detected);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  if (agents.length === 0) return null;

  const pickedIds = agents.filter((a) => picked[a.id]).map((a) => a.id);
  const allOn = pickedIds.length === agents.length;

  const toggle = (id: string): void => setPicked((m) => ({ ...m, [id]: !m[id] }));
  const toggleAll = (): void => {
    const next: Record<string, boolean> = {};
    for (const a of agents) next[a.id] = !allOn;
    setPicked(next);
  };

  const backup = (): void => {
    if (busy) return;
    if (pickedIds.length === 0) {
      store.toast('请至少勾选一个 Agent');
      return;
    }
    setBusy(true);
    void (async () => {
      try {
        const { count } = await ripple.backupAgents(pickedIds);
        await store.refresh();
        store.toast(`已为 ${count} 个技能创建备份`);
      } catch (err) {
        store.toast(`备份失败：${errText(err)}`);
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <div style={{ ...panelStyle, marginBottom: 14, maxWidth: 860 }}>
      <div style={{ fontWeight: 900, fontSize: 14, color: INK, marginBottom: 4 }}>按 Agent 备份</div>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: dim(0.55), lineHeight: 1.7 }}>
        勾选一个或多个 Agent，一键为其安装的全部技能（去重）创建备份。
      </p>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        {agents.map((a) => {
          const on = !!picked[a.id];
          return (
            <span
              key={a.id}
              className="rp-chip"
              onClick={() => toggle(a.id)}
              style={{
                ...segStyle(on),
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
              }}
            >
              <AgentIcon agentId={a.id} name={a.name} size={14} />
              {on ? '✓ ' : ''}
              {a.name}
            </span>
          );
        })}
        <span className="rp-chip" onClick={toggleAll} style={segStyle(allOn)}>
          全选
        </span>
        <span style={{ flex: 1 }} />
        <span
          className="rp-btn-grad"
          onClick={backup}
          style={{ ...gradBtn, fontSize: 12.5, padding: '8px 18px', opacity: busy ? 0.6 : undefined }}
        >
          {busy ? '备份中…' : `备份 (${pickedIds.length})`}
        </span>
      </div>
    </div>
  );
}

function BackupsTab(): ReactElement {
  const store = useStore();
  const { snapshot, restoredBackups } = store;
  const backups = snapshot?.backups ?? [];
  const backupsDir = snapshot?.settings.backups_dir ?? '~/.ripple/backups';

  const restore = (id: string, skill: string, version: string): void => {
    store.run(async () => {
      await ripple.restoreBackup(id);
      store.markBackupRestored(id);
      await store.refresh();
      await store.refreshUpdates();
      store.toast(`已从备份恢复「${skill}」v${version} 并启用`);
    });
  };

  const remove = (id: string): void => {
    store.run(async () => {
      await ripple.deleteBackup(id);
      await store.refresh();
      store.toast('备份已删除（不可恢复）');
    });
  };

  return (
    <>
      <AgentBackupPanel />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          border: '1px solid rgba(127,165,136,.25)',
          background: 'rgba(127,165,136,.05)',
          borderRadius: 11,
          padding: '10px 16px',
          marginBottom: 14,
          fontSize: 12,
          color: GREEN_DEEP,
          maxWidth: 860,
        }}
      >
        ✓ 更新、同步、卸载前自动创建备份，保留最近 20 份 · 目录 {backupsDir}/
      </div>
      <div style={{ maxWidth: 860 }}>
        {[...backups].reverse().map((b) => (
          <div
            key={b.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              border: '1px solid rgba(63,68,56,.08)',
              borderRadius: 13,
              background: '#ffffff',
              padding: '14px 18px',
              marginBottom: 10,
              fontSize: 12.5,
            }}
          >
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(147,168,107,.1)',
                color: PRIMARY,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 15,
                flex: 'none',
              }}
            >
              ⟲
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, color: INK, whiteSpace: 'nowrap' }}>{b.skill}</span>
                <span style={{ fontFamily: "'Space Grotesk',sans-serif", color: PRIMARY, whiteSpace: 'nowrap' }}>
                  v{b.version}
                </span>
                {restoredBackups[b.id] && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      background: 'rgba(127,165,136,.12)',
                      color: GREEN_DEEP,
                      borderRadius: 999,
                      padding: '2px 8px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    已恢复
                  </span>
                )}
              </div>
              <div style={{ color: dim(0.45), marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {b.reason} · {fmtBytes(b.size)}
              </div>
            </div>
            <span
              style={{
                fontFamily: "'Space Grotesk',sans-serif",
                fontSize: 11.5,
                color: dim(0.4),
                whiteSpace: 'nowrap',
                flex: 'none',
              }}
            >
              {fmtTime(b.created_at, true)}
            </span>
            <span
              className="rp-btn-outline"
              onClick={() => restore(b.id, b.skill, b.version)}
              style={{ ...outlineBtn, fontSize: 11.5, padding: '5px 14px', flex: 'none' }}
            >
              恢复
            </span>
            <span
              className="rp-hover-danger"
              onClick={() => remove(b.id)}
              title="删除备份（不可恢复）"
              style={{ color: 'rgba(75,80,64,.35)', cursor: 'pointer', flex: 'none', padding: '2px 5px', borderRadius: 5 }}
            >
              ✕
            </span>
          </div>
        ))}
        {backups.length === 0 && (
          <div style={{ textAlign: 'center', padding: '70px 0', color: dim(0.45) }}>
            <div style={{ fontSize: 14 }}>暂无备份</div>
            <div style={{ fontSize: 12.5, marginTop: 6, color: 'rgba(75,80,64,.35)' }}>更新 / 同步 / 卸载时会自动创建</div>
          </div>
        )}
      </div>
    </>
  );
}

/** 操作动作 → 中文徽标文案 */
const OP_LABELS: Record<string, string> = {
  install: '安装',
  update: '更新',
  sync: '同步',
  uninstall: '卸载',
  rollback: '回滚',
  restore: '恢复',
  backup: '备份',
  adopt: '接管',
  placement: '补齐',
  import: '导入',
  migrate: '迁移',
  enable: '启用',
  disable: '禁用',
  'add-source': '加来源',
  'remove-source': '移来源',
};

function OplogTab(): ReactElement {
  const store = useStore();
  const oplog = store.snapshot?.oplog ?? [];

  if (oplog.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '70px 0', color: dim(0.45) }}>
        <div style={{ fontSize: 14 }}>暂无操作记录</div>
        <div style={{ fontSize: 12.5, marginTop: 6, color: 'rgba(75,80,64,.35)' }}>
          安装、同步、备份等操作会自动记录在这里
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...panelStyle, maxWidth: 860, padding: '8px 20px' }}>
      {oplog.map((op, idx) => (
        <div
          key={`${op.at}-${idx}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 0',
            borderBottom: idx === oplog.length - 1 ? undefined : '1px dashed rgba(63,68,56,.08)',
            fontSize: 12.5,
          }}
        >
          <span
            style={{
              fontFamily: "'Space Grotesk',sans-serif",
              fontSize: 11.5,
              color: dim(0.4),
              whiteSpace: 'nowrap',
              flex: 'none',
              width: 96,
            }}
          >
            {fmtTime(op.at, true)}
          </span>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 999,
              background: 'rgba(147,168,107,.12)',
              color: PRIMARY,
              whiteSpace: 'nowrap',
              flex: 'none',
            }}
          >
            {OP_LABELS[op.action] ?? op.action}
          </span>
          <span style={{ fontWeight: 700, color: INK, whiteSpace: 'nowrap', flex: 'none' }}>{op.target}</span>
          <span
            style={{
              flex: 1,
              color: dim(0.5),
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {op.detail}
          </span>
        </div>
      ))}
    </div>
  );
}

/** 「关于与更新」tab：版本信息 + 手动检查更新全状态流 */
function AboutTab(): ReactElement {
  const store = useStore();
  const [version, setVersion] = useState('');
  const [status, setStatus] = useState('');
  const [checking, setChecking] = useState(false);
  const [percent, setPercent] = useState<number | null>(null);
  const [readyVersion, setReadyVersion] = useState<string | null>(null);

  useEffect(() => {
    void ripple.appVersion().then(setVersion);
  }, []);

  useEffect(
    () =>
      ripple.onUpdaterEvent((ev) => {
        if (ev.type === 'checking') setStatus('检查中…');
        if (ev.type === 'available') {
          setStatus(`发现新版本 v${ev.version ?? ''}，正在下载…`);
          setPercent(0);
        }
        if (ev.type === 'not-available') setStatus(`已是最新版本 v${version || (ev.version ?? '')}`);
        if (ev.type === 'progress') setPercent(ev.percent ?? null);
        if (ev.type === 'downloaded') {
          setReadyVersion(ev.version ?? '');
          setPercent(null);
          setStatus(`新版本 v${ev.version ?? ''} 已就绪`);
        }
        if (ev.type === 'error') {
          setPercent(null);
          setStatus(`更新失败：${ev.message ?? '未知错误'}（不影响使用）`);
        }
      }),
    [version],
  );

  const check = (): void => {
    setChecking(true);
    setStatus('检查中…');
    store.run(async () => {
      try {
        const result = await ripple.checkAppUpdate();
        if (result.message) setStatus(result.message);
        else if (!result.available) setStatus(`已是最新版本 v${result.current}`);
        else setStatus(`发现新版本 v${result.latest ?? ''}，正在下载…`);
      } finally {
        setChecking(false);
      }
    });
  };

  const panel: CSSProperties = {
    border: '1px solid rgba(63,68,56,.09)',
    borderRadius: 13,
    background: '#ffffff',
    padding: '18px 20px',
    maxWidth: 560,
  };
  const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, padding: '5px 0' };
  const label: CSSProperties = { width: 72, color: dim(0.5), flex: 'none' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={panel}>
        <div style={{ fontWeight: 900, fontSize: 14, color: INK, marginBottom: 8 }}>关于 Ripple</div>
        <div style={row}>
          <span style={label}>当前版本</span>
          <span style={{ fontFamily: MONO, color: INK, fontWeight: 700 }}>v{version || '…'}</span>
        </div>
        <div style={row}>
          <span style={label}>更新通道</span>
          <span style={{ color: dim(0.65) }}>
            GitHub Release ·{' '}
            <a href="https://github.com/hellosz/Ripple/releases" target="_blank" rel="noreferrer">
              hellosz/Ripple
            </a>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <span
            className="rp-btn-outline"
            onClick={checking ? undefined : check}
            style={{ ...outlineBtn, opacity: checking ? 0.5 : 1, cursor: checking ? 'default' : 'pointer' }}
          >
            {checking ? '检查中…' : '检查更新'}
          </span>
          {readyVersion !== null && (
            <span className="rp-btn-grad" onClick={() => void ripple.quitAndInstall()} style={gradBtn}>
              重启安装 v{readyVersion}
            </span>
          )}
        </div>
        {status && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: dim(0.6) }}>{status}</div>
        )}
        {percent !== null && (
          <div style={{ marginTop: 8, maxWidth: 360 }}>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(63,68,56,.08)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${percent}%`,
                  borderRadius: 3,
                  background: `linear-gradient(90deg, ${PRIMARY}, #b9c69a)`,
                  transition: 'width .3s',
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: dim(0.45), marginTop: 4, fontFamily: MONO }}>{percent}%</div>
          </div>
        )}
      </div>
      <div style={{ ...panel, fontSize: 12, color: dim(0.5), lineHeight: 1.8 }}>
        应用启动时会静默检查一次更新；发现新版本自动后台下载，完成后顶部出现「重启更新」横幅。
        开发模式（未打包运行）不检查更新。CLI 对应能力：`ripple version` 与 `ripple update`。
      </div>
    </div>
  );
}

export function SettingsView(): ReactElement {
  const store = useStore();
  const { settingsTab } = store;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        {(
          [
            { key: 'sources', name: '技能来源' },
            { key: 'ai', name: 'AI 服务商' },
            { key: 'backups', name: '备份管理' },
            { key: 'oplog', name: '操作记录' },
            { key: 'about', name: '关于与更新' },
          ] as const
        ).map((t) => (
          <span
            key={t.key}
            className="rp-chip"
            onClick={() => store.setSettingsTab(t.key)}
            style={{ ...chipStyle(settingsTab === t.key), fontSize: 12.5, padding: '7px 16px' }}
          >
            {t.name}
          </span>
        ))}
      </div>
      {settingsTab === 'sources' && <SourcesTab />}
      {settingsTab === 'ai' && <AiTab />}
      {settingsTab === 'backups' && <BackupsTab />}
      {settingsTab === 'oplog' && <OplogTab />}
      {settingsTab === 'about' && <AboutTab />}
    </>
  );
}
