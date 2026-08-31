import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { OriginType } from '@ripple/contract';
import { FileViewer } from '../components/file-viewer.js';
import type { SkillFileEntry } from '../components/file-viewer.js';
import { ripple } from '../ripple-api.js';
import { useStore } from '../store.js';
import { AMBER, INK, MONO, PRIMARY, SOFT, cmpVer, dim, fmtCount, gradBtn } from '../ui.js';

const ORIGIN_LABELS: Record<OriginType, string> = {
  original: '原创',
  derivative: '衍生',
  repost: '转载',
};

/** 热度分解四项：传播×1 + 收藏×2 + 评论×4 + 查询×0.05 */
function heatParts(item: {
  stats: { ripple_reach: number; like_count: number; comment_count: number; view_count: number };
}): { name: string; value: number }[] {
  return [
    { name: '传播', value: item.stats.ripple_reach },
    { name: '收藏', value: item.stats.like_count },
    { name: '评论', value: item.stats.comment_count },
    { name: '查询', value: item.stats.view_count },
  ];
}

/** 市场 Skill 详情：主要信息（对齐 Web 详情非文件部分）+ 已装技能附只读文件区块 */
export function MarketDetailModal(): ReactElement | null {
  const store = useStore();
  const { snapshot, marketDetail } = store;
  const [files, setFiles] = useState<SkillFileEntry[] | null>(null);

  const item = marketDetail;
  const installed = !!item && !!snapshot && item.name in snapshot.skills;
  const localVersion = item ? (snapshot?.skills[item.name]?.version ?? null) : null;
  const hasUpdate = installed && localVersion !== null && item !== null && cmpVer(localVersion, item.version) < 0;

  useEffect(() => {
    setFiles(null);
    if (item && installed) {
      ripple
        .readSkillFiles(item.name)
        .then(setFiles)
        .catch(() => setFiles(null)); // 文件读取失败不阻塞主要信息展示
    }
  }, [item, installed]);

  if (!item) return null;

  const close = (): void => store.setMarketDetail(null);
  const parts = heatParts(item);
  const maxPart = Math.max(1, ...parts.map((p) => p.value));

  const copyCmd = (): void => {
    void navigator.clipboard
      .writeText(item.install_command)
      .then(() => store.toast('安装命令已复制'))
      .catch(() => store.toast('复制失败'));
  };

  const install = (): void => {
    close();
    store.openRegistrySync(item.name);
  };

  const metaCell = (label: string, value: string): ReactElement => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: dim(0.4), marginBottom: 2 }}>{label}</div>
      <div
        style={{
          fontSize: 12.5,
          fontWeight: 700,
          color: INK,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </div>
    </div>
  );

  return (
    <div
      onClick={close}
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
          width: 720,
          maxWidth: '92vw',
          maxHeight: '86vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 20px 50px rgba(63,68,56,.2)',
          animation: 'slide-up .25s cubic-bezier(.16,1,.3,1)',
          overflow: 'hidden',
        }}
      >
        {/* 标题区 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 24px 0', flex: 'none' }}>
          <span style={{ fontWeight: 900, fontSize: 18, color: INK, whiteSpace: 'nowrap' }}>{item.display_name}</span>
          <span
            style={{
              fontSize: 10.5,
              padding: '2px 9px',
              borderRadius: 999,
              background: 'rgba(147,168,107,.1)',
              color: PRIMARY,
              whiteSpace: 'nowrap',
              flex: 'none',
            }}
          >
            {item.category ?? '技能'}
          </span>
          <span
            style={{
              fontSize: 10.5,
              padding: '2px 9px',
              borderRadius: 999,
              background: 'rgba(75,80,64,.07)',
              color: dim(0.55),
              whiteSpace: 'nowrap',
              flex: 'none',
            }}
          >
            {ORIGIN_LABELS[item.origin_type]}
          </span>
          <span style={{ flex: 1 }} />
          <span
            style={{ fontFamily: MONO, fontSize: 13, color: PRIMARY, fontWeight: 700, whiteSpace: 'nowrap', flex: 'none' }}
          >
            ♨ {item.stats.heat}
          </span>
          <span
            className="rp-hover-primary"
            onClick={close}
            style={{ color: dim(0.4), cursor: 'pointer', fontSize: 15, flex: 'none', padding: '0 2px' }}
          >
            ✕
          </span>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 24px 0' }}>
          {/* 元信息 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
            {metaCell('作者', item.author.nickname ?? item.author.email)}
            {metaCell('最新版本', `v${item.version}`)}
            {metaCell('本地版本', localVersion ? `v${localVersion}` : '未安装')}
          </div>

          {/* 描述 */}
          <p style={{ margin: '0 0 16px', fontSize: 13, lineHeight: 1.8, color: dim(0.65) }}>{item.description}</p>

          {/* 热度分解 */}
          <div
            style={{
              border: '1px solid rgba(63,68,56,.08)',
              borderRadius: 12,
              padding: '14px 16px',
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 11.5, fontWeight: 700, color: dim(0.5), marginBottom: 10 }}>
              热度分解（传播×1 + 收藏×2 + 评论×4 + 查询×0.05，按周归一化）
            </div>
            {parts.map((p) => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                <span style={{ width: 32, fontSize: 11.5, color: dim(0.55), flex: 'none' }}>{p.name}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'rgba(75,80,64,.07)' }}>
                  <div
                    style={{
                      width: `${Math.max(2, Math.round((p.value / maxPart) * 100))}%`,
                      height: '100%',
                      borderRadius: 999,
                      background: 'linear-gradient(90deg,#93a86b,#b9c69a)',
                    }}
                  />
                </div>
                <span
                  style={{ width: 48, textAlign: 'right', fontFamily: MONO, fontSize: 11.5, color: dim(0.5), flex: 'none' }}
                >
                  {fmtCount(p.value)}
                </span>
              </div>
            ))}
          </div>

          {/* 安装命令 */}
          <div
            className="rp-chip"
            onClick={copyCmd}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'rgba(63,68,56,.04)',
              border: '1px solid rgba(63,68,56,.08)',
              borderRadius: 9,
              padding: '9px 13px',
              fontFamily: MONO,
              fontSize: 12,
              color: PRIMARY,
              cursor: 'pointer',
              marginBottom: 16,
            }}
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.install_command}
            </span>
            <span style={{ fontSize: 11, color: dim(0.45), whiteSpace: 'nowrap', fontFamily: "'Noto Sans SC',sans-serif" }}>
              复制
            </span>
          </div>

          {/* 已安装：本地文件（只读） */}
          {installed && files !== null && files.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: dim(0.5), marginBottom: 8 }}>本地文件</div>
              <FileViewer
                files={files}
                height={280}
                loadAsset={(p) => ripple.readSkillAsset(item.name, p)}
              />
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 24px 18px',
            borderTop: '1px solid rgba(63,68,56,.06)',
            flex: 'none',
          }}
        >
          {hasUpdate && (
            <span style={{ fontSize: 12, color: AMBER, fontWeight: 700 }}>
              远端 v{item.version} 可同步（本地 v{localVersion}）
            </span>
          )}
          {installed && !hasUpdate && (
            <span style={{ fontSize: 12, color: SOFT, fontWeight: 700 }}>已安装 · 与市场一致</span>
          )}
          <span style={{ flex: 1 }} />
          <span
            className="rp-btn-grad"
            onClick={install}
            style={{
              ...gradBtn,
              fontSize: 13,
              borderRadius: 9,
              padding: '9px 24px',
              ...(hasUpdate ? { background: 'linear-gradient(135deg,#a98a5b,#c4ab84)' } : {}),
            }}
          >
            {installed ? (hasUpdate ? '同步更新…' : '同步…') : '安装…'}
          </span>
        </div>
      </div>
    </div>
  );
}
