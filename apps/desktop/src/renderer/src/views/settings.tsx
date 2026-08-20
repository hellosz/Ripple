import { useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import { ripple } from '../ripple-api.js';
import { useStore } from '../store.js';
import {
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
  const [draft, setDraft] = useState({ owner: '', name: '', branch: '', subdir: '' });

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
    if (!draft.owner.trim() || !draft.name.trim()) {
      store.toast('Owner 和仓库名必填');
      return;
    }
    store.run(async () => {
      const spec =
        `${draft.owner.trim()}/${draft.name.trim()}` +
        (draft.branch.trim() ? `#${draft.branch.trim()}` : '') +
        (draft.subdir.trim() ? `:${draft.subdir.trim()}` : '');
      const repo = await ripple.addSource(spec);
      setFormOpen(false);
      setDraft({ owner: '', name: '', branch: '', subdir: '' });
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

      {/* GitHub 仓库 */}
      <div style={panelStyle}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontWeight: 900, fontSize: 14, color: INK }}>GitHub 仓库</span>
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
          本地模式也可用：直接从 GitHub 仓库扫描并安装技能，支持指定分支与子目录。
        </p>
        {formOpen && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', animation: 'fade-in .2s ease-out' }}>
            <input
              className="rp-input"
              value={draft.owner}
              onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
              placeholder="Owner *"
              style={{ ...inputStyle, flex: 1, minWidth: 110 }}
            />
            <input
              className="rp-input"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="仓库名 *"
              style={{ ...inputStyle, flex: 1, minWidth: 110 }}
            />
            <input
              className="rp-input"
              value={draft.branch}
              onChange={(e) => setDraft({ ...draft, branch: e.target.value })}
              placeholder="分支 (main)"
              style={{ ...inputStyle, width: 100 }}
            />
            <input
              className="rp-input"
              value={draft.subdir}
              onChange={(e) => setDraft({ ...draft, subdir: e.target.value })}
              placeholder="子目录（可选）"
              style={{ ...inputStyle, width: 120 }}
            />
            <span className="rp-btn-grad" onClick={addRepo} style={{ ...gradBtn, fontSize: 12.5, padding: '8px 18px' }}>
              添加
            </span>
          </div>
        )}
        {sources.map((rp) => {
          const label = `${rp.owner}/${rp.repo}${rp.subdir ? ` › ${rp.subdir}` : ''}`;
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

export function SettingsView(): ReactElement {
  const store = useStore();
  const { settingsTab } = store;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        {(
          [
            { key: 'sources', name: '技能来源' },
            { key: 'backups', name: '备份管理' },
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
      {settingsTab === 'sources' ? <SourcesTab /> : <BackupsTab />}
    </>
  );
}
