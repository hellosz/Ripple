import type { CSSProperties, ReactElement } from 'react';
import type { SkillListItem } from '@ripple/contract';
import { useStore } from '../store.js';
import { AMBER, GREEN, INK, PRIMARY, cardStyle, chipStyle, cmpVer, dim, fmtCount, gradBtn } from '../ui.js';
import { ripple } from '../ripple-api.js';

const FALLBACK_GRAD = 'linear-gradient(90deg,#93a86b,#b9c69a)';

function authorName(item: SkillListItem): string {
  return item.author.nickname ?? item.author.email;
}

export function MarketView(): ReactElement {
  const store = useStore();
  const { snapshot, marketItems, collections, marketTab, query } = store;
  const installedSkills = new Set((snapshot?.installs ?? []).map((i) => i.skill));

  /** 本地状态：未装 / 已装最新 / 已装但远端有新版（对比 SSOT 版本与市场版本） */
  const localState = (item: SkillListItem): { installed: boolean; hasUpdate: boolean } => {
    const localVer = snapshot?.skills[item.name]?.version ?? null;
    const installed = installedSkills.has(item.name) || item.name in (snapshot?.skills ?? {});
    const hasUpdate = installed && localVer !== null && cmpVer(localVer, item.version) < 0;
    return { installed, hasUpdate };
  };

  const installBtn = (item: SkillListItem, fixedWidth: boolean): ReactElement => {
    const { installed, hasUpdate } = localState(item);
    const style: CSSProperties = installed
      ? {
          border: `1px solid ${hasUpdate ? 'rgba(169,138,91,.55)' : 'rgba(107,127,67,.4)'}`,
          color: hasUpdate ? AMBER : PRIMARY,
          fontWeight: 700,
          borderRadius: 8,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }
      : { ...gradBtn };
    return (
      <span
        className={installed ? 'rp-btn-outline' : 'rp-btn-grad'}
        onClick={(e) => {
          e.stopPropagation();
          store.openRegistrySync(item.name);
        }}
        style={{
          ...style,
          fontSize: fixedWidth ? 11.5 : 12,
          padding: fixedWidth ? '6px 13px' : '6px 14px',
          ...(fixedWidth ? { flex: 'none', textAlign: 'center', width: 56 } : {}),
        }}
      >
        {installed ? '同步…' : '安装…'}
      </span>
    );
  };

  if (marketItems === null) {
    return <div style={{ textAlign: 'center', padding: '80px 0', color: dim(0.45) }}>正在加载技能市场…</div>;
  }

  const q = query.trim();
  const items = marketItems.filter(
    (m) => !q || m.display_name.includes(q) || m.name.includes(q) || m.description.includes(q),
  );

  return (
    <>
      {/* 市场子视图 tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        {(
          [
            { key: 'browse', name: '浏览' },
            { key: 'rank', name: '排行榜' },
            { key: 'collections', name: '合集' },
          ] as const
        ).map((t) => (
          <span
            key={t.key}
            className="rp-chip"
            onClick={() => store.setMarketTab(t.key)}
            style={chipStyle(marketTab === t.key)}
          >
            {t.name}
          </span>
        ))}
      </div>

      {/* 浏览网格 */}
      {marketTab === 'browse' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {items.map((m) => {
            const { installed, hasUpdate } = localState(m);
            // 底部 3px 进度条：未装无条；已装 100% 安装态色；有远端新版 100% 待同步色（琥珀）
            const barColor = installed
              ? hasUpdate
                ? AMBER
                : 'var(--rp-primary-soft)'
              : 'transparent';
            return (
              <div
                key={m.id}
                onClick={() => store.setMarketDetail(m)}
                title={
                  installed
                    ? hasUpdate
                      ? `已安装 · 远端有新版 v${m.version}`
                      : '已安装 · 与市场一致'
                    : undefined
                }
                style={{
                  ...cardStyle,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                }}
              >
                <div style={{ padding: '16px 18px 14px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: INK, whiteSpace: 'nowrap' }}>
                      {m.display_name}
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: 'rgba(147,168,107,.1)',
                        color: PRIMARY,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {m.category ?? '技能'}
                    </span>
                    <span style={{ flex: 1 }} />
                    <span
                      style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 11.5, color: PRIMARY, whiteSpace: 'nowrap' }}
                    >
                      ♨ {m.stats.heat}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.7, color: dim(0.6), minHeight: 34 }}>
                    {m.description}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: dim(0.45) }}>
                    <span>
                      {authorName(m)} · v{m.version}
                    </span>
                    <span style={{ flex: 1 }} />
                    {installBtn(m, false)}
                  </div>
                </div>
                <div style={{ height: 3, flex: 'none', background: barColor }} />
              </div>
            );
          })}
          {items.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '80px 0', color: dim(0.45) }}>
              没有匹配的技能
            </div>
          )}
        </div>
      )}

      {/* 排行榜 */}
      {marketTab === 'rank' && (
        <>
          <div style={{ ...cardStyle, overflow: 'hidden' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '11px 18px',
                borderBottom: '1px solid rgba(63,68,56,.06)',
                fontSize: 11,
                fontWeight: 700,
                color: dim(0.45),
              }}
            >
              <span style={{ width: 28, flex: 'none' }}>#</span>
              <span style={{ flex: 1 }}>技能</span>
              <span style={{ width: 120, flex: 'none' }}>作者</span>
              <span style={{ width: 70, flex: 'none', textAlign: 'right' }}>热度</span>
              <span style={{ width: 90, flex: 'none', textAlign: 'right' }}>周传播</span>
              <span style={{ width: 76, flex: 'none' }} />
            </div>
            {[...items]
              .sort((a, b) => b.stats.heat - a.stats.heat)
              .map((m, idx) => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 18px',
                    borderBottom: '1px solid rgba(63,68,56,.05)',
                    fontSize: 13,
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      flex: 'none',
                      fontFamily: "'Space Grotesk',sans-serif",
                      fontWeight: 700,
                      fontSize: 15,
                      color: idx === 0 ? PRIMARY : idx < 3 ? 'rgba(107,127,67,.6)' : 'rgba(75,80,64,.3)',
                    }}
                  >
                    {idx + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, color: INK, whiteSpace: 'nowrap' }}>{m.display_name}</span>
                      <span
                        style={{
                          fontSize: 10.5,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: 'rgba(147,168,107,.08)',
                          color: PRIMARY,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {m.category ?? '技能'}
                      </span>
                    </div>
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
                      {m.description}
                    </div>
                  </div>
                  <span style={{ width: 120, flex: 'none', fontSize: 12, color: dim(0.55), whiteSpace: 'nowrap' }}>
                    {authorName(m)}
                  </span>
                  <span
                    style={{
                      width: 70,
                      flex: 'none',
                      textAlign: 'right',
                      fontFamily: "'Space Grotesk',sans-serif",
                      fontWeight: 700,
                      color: PRIMARY,
                    }}
                  >
                    {m.stats.heat}
                  </span>
                  <span
                    style={{
                      width: 90,
                      flex: 'none',
                      textAlign: 'right',
                      fontFamily: "'Space Grotesk',sans-serif",
                      fontSize: 12,
                      color: dim(0.5),
                    }}
                  >
                    {fmtCount(m.stats.ripple_reach)}
                  </span>
                  {installBtn(m, true)}
                </div>
              ))}
          </div>
          <div style={{ fontSize: 11.5, color: dim(0.4), marginTop: 10 }}>
            热度 = 传播×1 + 收藏×2 + 评论×4 + 查询×0.05，按周归一化
          </div>
        </>
      )}

      {/* 合集 */}
      {marketTab === 'collections' &&
        (collections === null ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: dim(0.45) }}>正在加载合集…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }}>
            {collections.map((co) => {
              const missing = co.skills.filter((m) => !installedSkills.has(m.name));
              const installAll = (): void => {
                if (missing.length === 0) {
                  store.toast(`「${co.name}」已全部安装`);
                  return;
                }
                store.run(async () => {
                  const agent = snapshot?.settings.default_agent ?? 'claude-code';
                  for (const m of missing) await ripple.installFromRegistry(m.name, [{ agent }]);
                  await store.refresh();
                  store.toast(`已备份并安装「${co.name}」的 ${missing.length} 个技能`);
                });
              };
              return (
                <div key={co.id} style={{ ...cardStyle, overflow: 'hidden' }}>
                  <div style={{ height: 5, background: co.gradient ?? FALLBACK_GRAD }} />
                  <div style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontWeight: 900, fontSize: 15, color: INK, whiteSpace: 'nowrap' }}>{co.name}</span>
                      <span
                        style={{
                          fontSize: 10.5,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: 'rgba(147,168,107,.08)',
                          color: PRIMARY,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {co.skill_count} 个技能
                      </span>
                      <span style={{ flex: 1 }} />
                      <span style={{ fontSize: 11, color: dim(0.45), whiteSpace: 'nowrap' }}>{co.curator} 策展</span>
                    </div>
                    <p style={{ margin: '7px 0 12px', fontSize: 12.5, lineHeight: 1.7, color: dim(0.6) }}>
                      {co.description}
                    </p>
                    {co.skills.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 9,
                          padding: '7px 0',
                          borderTop: '1px dashed rgba(63,68,56,.06)',
                          fontSize: 12.5,
                        }}
                      >
                        <span style={{ fontWeight: 700, color: INK, whiteSpace: 'nowrap' }}>{m.display_name}</span>
                        <span
                          style={{
                            flex: 1,
                            fontSize: 11.5,
                            color: dim(0.45),
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {m.description}
                        </span>
                        {installedSkills.has(m.name) && (
                          <span style={{ fontSize: 10.5, color: GREEN, fontWeight: 700, whiteSpace: 'nowrap' }}>✓</span>
                        )}
                        <span
                          style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 11, color: PRIMARY, whiteSpace: 'nowrap' }}
                        >
                          {m.stats.heat}
                        </span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <span
                        className="rp-btn-grad"
                        onClick={installAll}
                        style={{ ...gradBtn, flex: 1, textAlign: 'center', fontSize: 12, padding: '8px 0' }}
                      >
                        装齐整套（{missing.length} 个未装）
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {collections.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '80px 0', color: dim(0.45) }}>
                暂无合集
              </div>
            )}
          </div>
        ))}
    </>
  );
}
