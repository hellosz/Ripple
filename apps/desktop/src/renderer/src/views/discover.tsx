import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { DiscoverIndex, DiscoverRepo, DiscoverRepoSkills } from '@ripple/hub';
import { ripple } from '../ripple-api.js';
import { errText, useStore } from '../store.js';
import {
  AMBER,
  DANGER,
  GREEN_DEEP,
  INK,
  MONO,
  PRIMARY,
  cardStyle,
  dim,
  fmtCount,
  fmtRelative,
  gradBtn,
  inputStyle,
  outlineBtn,
} from '../ui.js';

const repoKey = (r: Pick<DiscoverRepo, 'owner' | 'repo'>): string => `${r.owner}/${r.repo}`;

/** 本地评级 S/A/B/C 徽标配色 */
const GRADE_COLORS: Record<string, string> = { S: PRIMARY, A: GREEN_DEEP, B: AMBER, C: DANGER };

function GradeBadge({ grade }: { grade: string }): ReactElement {
  const color = GRADE_COLORS[grade] ?? AMBER;
  return (
    <span
      title={`本地规则评级 ${grade}（安装前可再做 AI 评分）`}
      style={{
        fontSize: 10,
        fontWeight: 900,
        width: 18,
        height: 18,
        borderRadius: 6,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `${color}1c`,
        color,
        flex: 'none',
        fontFamily: MONO,
      }}
    >
      {grade}
    </span>
  );
}

const ORIGIN_LABELS: Record<DiscoverRepo['origin'], { text: string; color: string }> = {
  curated: { text: '精选', color: PRIMARY },
  'topic-search': { text: '生态搜索', color: '#4b7fb0' },
  'code-search': { text: '深搜', color: AMBER },
};

function qualityBadge(text: string, color: string, title?: string): ReactElement {
  return (
    <span
      key={text}
      title={title}
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 999,
        background: `${color}14`,
        color,
        whiteSpace: 'nowrap',
        flex: 'none',
      }}
    >
      {text}
    </span>
  );
}

/** 远端技能只读预览：元信息（未订阅仓库无文件通道，添加为来源并安装后可浏览全文） */
function RemoteSkillPreview({
  skill,
  repoLabel,
  onClose,
}: {
  skill: DiscoverRepoSkills['skills'][number];
  repoLabel: string;
  onClose: () => void;
}): ReactElement {
  const metaRow = (label: string, value: string): ReactElement => (
    <div style={{ display: 'flex', gap: 10, fontSize: 12.5, padding: '5px 0' }}>
      <span style={{ width: 72, color: dim(0.5), flex: 'none' }}>{label}</span>
      <span style={{ fontFamily: MONO, color: INK, minWidth: 0, overflowWrap: 'anywhere' }}>{value}</span>
    </div>
  );
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
          maxWidth: '94vw',
          maxHeight: '86vh',
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 20px 50px rgba(63,68,56,.2)',
          animation: 'slide-up .25s cubic-bezier(.16,1,.3,1)',
          padding: '20px 24px 22px',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontWeight: 900, fontSize: 16, color: INK, whiteSpace: 'nowrap' }}>{skill.name}</span>
          <span style={{ fontFamily: MONO, fontSize: 12, color: PRIMARY, whiteSpace: 'nowrap' }}>v{skill.version}</span>
          <GradeBadge grade={skill.local_grade} />
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 999,
              background: 'rgba(75,80,64,.08)',
              color: dim(0.55),
              whiteSpace: 'nowrap',
              flex: 'none',
            }}
          >
            只读预览
          </span>
          <span style={{ flex: 1 }} />
          <span
            className="rp-hover-primary"
            onClick={onClose}
            style={{ color: dim(0.4), cursor: 'pointer', fontSize: 15, flex: 'none', padding: '0 2px' }}
          >
            ✕
          </span>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: 12.5, lineHeight: 1.8, color: dim(0.6) }}>
          {skill.description || '暂无简介'}
        </p>
        {metaRow('来源仓库', repoLabel)}
        {metaRow('仓库路径', skill.repoPath || '(根目录)')}
        {metaRow('内容指纹', skill.fingerprint.slice(0, 16))}
        <div
          style={{
            marginTop: 14,
            border: '1px solid rgba(127,165,136,.25)',
            background: 'rgba(127,165,136,.05)',
            borderRadius: 10,
            padding: '9px 14px',
            fontSize: 12,
            color: dim(0.55),
            lineHeight: 1.7,
          }}
        >
          「添加为来源」订阅该仓库后，可在「社区开源」中安装此技能；安装后支持浏览完整文件树与渲染预览。
        </div>
      </div>
    </div>
  );
}

/** 发现视图：curated 种子 + GitHub topic 搜索排行，懒扫描技能清单，一键添加为来源 */
export function DiscoverView(): ReactElement {
  const store = useStore();
  const { snapshot } = store;
  const [index, setIndex] = useState<DiscoverIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('');
  /** 展开的仓库 key 及其技能清单（null=加载中，string=错误） */
  const [expanded, setExpanded] = useState<string | null>(null);
  const [repoSkills, setRepoSkills] = useState<Record<string, DiscoverRepoSkills | string | null>>({});
  const [adding, setAdding] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<{ skill: DiscoverRepoSkills['skills'][number]; repoLabel: string } | null>(null);
  // PAT 深搜
  const [patConfigured, setPatConfigured] = useState<boolean | null>(null);
  const [patDraft, setPatDraft] = useState('');
  const [patBusy, setPatBusy] = useState(false);
  const [deepBusy, setDeepBusy] = useState(false);

  const load = (refresh: boolean): void => {
    if (refresh) setRefreshing(true);
    ripple
      .discoverIndex(refresh)
      .then((idx) => {
        setIndex(idx);
        setError(null);
      })
      .catch((err: unknown) => setError(errText(err)))
      .finally(() => setRefreshing(false));
  };

  useEffect(() => {
    load(false);
    ripple
      .discoverPatStatus()
      .then((s) => setPatConfigured(s.configured))
      .catch(() => setPatConfigured(false));
    // 仅挂载时加载一次
  }, []);

  const sources = snapshot?.sources ?? [];
  const subscribed = (r: DiscoverRepo): boolean => sources.some((s) => s.id === repoKey(r));

  const toggleRepo = (r: DiscoverRepo): void => {
    const key = repoKey(r);
    if (expanded === key) {
      setExpanded(null);
      return;
    }
    setExpanded(key);
    if (repoSkills[key] === undefined || typeof repoSkills[key] === 'string') {
      setRepoSkills((m) => ({ ...m, [key]: null }));
      ripple
        .discoverRepo(r.owner, r.repo, r.branch, r.pushed_at)
        .then((res) => setRepoSkills((m) => ({ ...m, [key]: res })))
        .catch((err: unknown) => setRepoSkills((m) => ({ ...m, [key]: errText(err) })));
    }
  };

  const addAsSource = (r: DiscoverRepo): void => {
    const key = repoKey(r);
    if (adding[key] || subscribed(r)) return;
    setAdding((m) => ({ ...m, [key]: true }));
    void (async () => {
      try {
        const spec = r.branch && r.branch !== 'main' ? `${key}#${r.branch}` : key;
        await ripple.addSource(spec);
        await store.refresh();
        await store.loadCommunity(true);
        store.toast(`已订阅 ${key}，可在「社区开源」中安装其技能`);
      } catch (err) {
        store.toast(`添加来源失败：${errText(err)}`);
      } finally {
        setAdding((m) => ({ ...m, [key]: false }));
      }
    })();
  };

  const savePat = (): void => {
    const pat = patDraft.trim();
    if (!pat || patBusy) return;
    setPatBusy(true);
    void (async () => {
      try {
        await ripple.discoverSetPat(pat);
        setPatConfigured(true);
        setPatDraft('');
        store.toast('GitHub PAT 已加密保存（safeStorage）');
      } catch (err) {
        store.toast(`保存失败：${errText(err)}`);
      } finally {
        setPatBusy(false);
      }
    })();
  };

  const clearPat = (): void => {
    if (patBusy) return;
    setPatBusy(true);
    void (async () => {
      try {
        await ripple.discoverSetPat(null);
        setPatConfigured(false);
        store.toast('已清除 GitHub PAT');
      } catch (err) {
        store.toast(`清除失败：${errText(err)}`);
      } finally {
        setPatBusy(false);
      }
    })();
  };

  const deepSearch = (): void => {
    if (deepBusy) return;
    setDeepBusy(true);
    void (async () => {
      try {
        const extra = await ripple.discoverDeepSearch(filter.trim() || undefined);
        setIndex((idx) => {
          if (!idx) return idx;
          const seen = new Set(idx.repos.map(repoKey));
          const merged = [...idx.repos, ...extra.filter((r) => !seen.has(repoKey(r)))];
          return { ...idx, repos: merged };
        });
        store.toast(`深度探索返回 ${extra.length} 个仓库（origin=深搜，已合并去重）`);
      } catch (err) {
        store.toast(`深度探索失败：${errText(err)}`);
      } finally {
        setDeepBusy(false);
      }
    })();
  };

  const q = filter.trim().toLowerCase();
  const repos = (index?.repos ?? [])
    .filter(
      (r) =>
        !q ||
        repoKey(r).toLowerCase().includes(q) ||
        r.topics.some((t) => t.toLowerCase().includes(q)) ||
        (r.note ?? '').toLowerCase().includes(q),
    )
    .sort((a, b) => b.stars - a.stars);

  const active90d = (r: DiscoverRepo): boolean =>
    r.pushed_at !== null && Date.now() - new Date(r.pushed_at).getTime() < 90 * 86400e3;

  const loading = index === null && error === null;

  return (
    <>
      {/* 说明 + 搜索 + 刷新 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 12.5, color: dim(0.55), whiteSpace: 'nowrap' }}>
          精选种子 + GitHub 生态搜索，按 stars 排行；点开仓库扫描技能并本地评级。
        </span>
        <span style={{ flex: 1 }} />
        <input
          className="rp-input"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="过滤 owner/repo、topic…"
          style={{ ...inputStyle, width: 210, flex: 'none' }}
        />
        <span
          className="rp-btn-outline"
          onClick={() => load(true)}
          style={{ ...outlineBtn, fontSize: 12, padding: '6px 14px', flex: 'none', opacity: refreshing ? 0.5 : undefined }}
        >
          {refreshing ? '刷新中…' : '⟳ 刷新'}
        </span>
      </div>

      {index?.degraded === true && (
        <div
          style={{
            border: '1px solid rgba(169,138,91,.3)',
            background: 'rgba(169,138,91,.07)',
            borderRadius: 11,
            padding: '9px 15px',
            marginBottom: 12,
            fontSize: 12,
            color: AMBER,
          }}
        >
          GitHub 配额受限或网络不可达：当前展示缓存 / 内置榜单，稍后可重试刷新。
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: dim(0.45), fontSize: 13 }}>
          正在获取发现榜单…
        </div>
      )}
      {error !== null && index === null && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: dim(0.5) }}>
          <div style={{ fontSize: 14, color: DANGER }}>加载失败：{error}</div>
          <span
            className="rp-btn-outline"
            onClick={() => load(true)}
            style={{ ...outlineBtn, display: 'inline-block', fontSize: 12.5, padding: '7px 18px', marginTop: 14 }}
          >
            重试
          </span>
        </div>
      )}
      {!loading && index !== null && repos.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: dim(0.5), fontSize: 13 }}>
          没有匹配的仓库
        </div>
      )}

      {repos.map((r) => {
        const key = repoKey(r);
        const isOpen = expanded === key;
        const skills = repoSkills[key];
        const origin = ORIGIN_LABELS[r.origin];
        const subbed = subscribed(r);
        return (
          <div key={key} style={{ ...cardStyle, marginBottom: 10, overflow: 'hidden' }}>
            <div
              className="rp-hover-row"
              onClick={() => toggleRepo(r)}
              title={isOpen ? '收起' : '点击扫描仓库技能'}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', cursor: 'pointer' }}
            >
              <span style={{ fontSize: 10, color: dim(0.45), width: 12, flex: 'none' }}>{isOpen ? '▾' : '▸'}</span>
              <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: 13.5, color: INK, whiteSpace: 'nowrap' }}>
                {key}
              </span>
              {qualityBadge(origin.text, origin.color, r.note)}
              {qualityBadge(`★ ${fmtCount(r.stars)}`, INK, 'GitHub stars')}
              {active90d(r) && qualityBadge('活跃', GREEN_DEEP, `最近推送 ${fmtRelative(r.pushed_at!)}`)}
              {r.license !== null && qualityBadge(r.license, dim(0.55), '开源许可证')}
              <span
                style={{
                  fontSize: 11,
                  color: dim(0.4),
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                  flex: 1,
                  fontFamily: MONO,
                }}
              >
                {r.topics.slice(0, 4).join(' · ')}
              </span>
              {subbed ? (
                <span style={{ fontSize: 11.5, color: GREEN_DEEP, fontWeight: 700, flex: 'none', whiteSpace: 'nowrap' }}>
                  ✓ 已订阅
                </span>
              ) : (
                <span
                  className="rp-btn-outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    addAsSource(r);
                  }}
                  style={{
                    ...outlineBtn,
                    fontSize: 11.5,
                    padding: '5px 13px',
                    flex: 'none',
                    opacity: adding[key] ? 0.5 : undefined,
                  }}
                >
                  {adding[key] ? '添加中…' : '添加为来源'}
                </span>
              )}
            </div>
            {isOpen && (
              <div style={{ borderTop: '1px dashed rgba(63,68,56,.08)', padding: '4px 18px 10px 40px' }}>
                {skills === null && (
                  <div style={{ padding: '16px 0', color: dim(0.45), fontSize: 12.5 }}>
                    正在拉取仓库并扫描技能（经 codeload，不占 API 配额）…
                  </div>
                )}
                {typeof skills === 'string' && (
                  <div style={{ padding: '14px 0', fontSize: 12.5, color: DANGER }}>
                    扫描失败：{skills}{' '}
                    <span
                      className="rp-hover-primary"
                      onClick={() => {
                        setRepoSkills((m) => ({ ...m, [key]: null }));
                        ripple
                          .discoverRepo(r.owner, r.repo, r.branch, r.pushed_at)
                          .then((res) => setRepoSkills((m) => ({ ...m, [key]: res })))
                          .catch((err: unknown) => setRepoSkills((m) => ({ ...m, [key]: errText(err) })));
                      }}
                      style={{ color: PRIMARY, cursor: 'pointer', fontWeight: 700, marginLeft: 8 }}
                    >
                      重试
                    </span>
                  </div>
                )}
                {skills !== null && typeof skills === 'object' && skills.skills.length === 0 && (
                  <div style={{ padding: '14px 0', color: dim(0.45), fontSize: 12.5 }}>
                    此仓库内未发现技能（缺少 SKILL.md）
                  </div>
                )}
                {skills !== null &&
                  typeof skills === 'object' &&
                  skills.skills.map((s) => (
                    <div
                      key={s.name}
                      className="rp-hover-row"
                      onClick={() => setPreview({ skill: s, repoLabel: key })}
                      title="点击查看只读预览"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 6px',
                        borderRadius: 8,
                        fontSize: 12.5,
                        cursor: 'pointer',
                      }}
                    >
                      <GradeBadge grade={s.local_grade} />
                      <span style={{ fontWeight: 700, color: INK, whiteSpace: 'nowrap' }}>{s.name}</span>
                      <span style={{ fontFamily: MONO, fontSize: 11, color: PRIMARY, whiteSpace: 'nowrap' }}>
                        v{s.version}
                      </span>
                      <span
                        style={{
                          fontSize: 11.5,
                          color: dim(0.45),
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        {s.description || '暂无简介'}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        );
      })}

      {/* PAT 深度探索（可选） */}
      {!loading && (
        <div style={{ ...cardStyle, marginTop: 16, padding: '14px 18px', maxWidth: 860 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 900, fontSize: 13, color: INK, whiteSpace: 'nowrap' }}>深度探索（可选）</span>
            <span style={{ fontSize: 11.5, color: dim(0.5), whiteSpace: 'nowrap' }}>
              配置 GitHub PAT 后按 SKILL.md 全网检索（10 次/分钟限速）
            </span>
            <span style={{ flex: 1 }} />
            {patConfigured === true ? (
              <>
                <span style={{ fontSize: 11.5, color: GREEN_DEEP, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  ✓ PAT 已配置
                </span>
                <span
                  className="rp-btn-grad"
                  onClick={deepSearch}
                  style={{ ...gradBtn, fontSize: 11.5, padding: '5px 14px', opacity: deepBusy ? 0.5 : undefined }}
                >
                  {deepBusy ? '检索中…' : filter.trim() ? `深搜「${filter.trim()}」` : '深度探索'}
                </span>
                <span
                  className="rp-hover-danger"
                  onClick={clearPat}
                  style={{ fontSize: 11.5, color: dim(0.4), cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  清除 PAT
                </span>
              </>
            ) : (
              <>
                <input
                  className="rp-input"
                  type="password"
                  value={patDraft}
                  onChange={(e) => setPatDraft(e.target.value)}
                  placeholder="ghp_…（safeStorage 加密存储）"
                  style={{ ...inputStyle, width: 240, flex: 'none' }}
                />
                <span
                  className="rp-btn-outline"
                  onClick={savePat}
                  style={{ ...outlineBtn, fontSize: 11.5, padding: '5px 14px', opacity: patBusy || !patDraft.trim() ? 0.5 : undefined }}
                >
                  保存
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {preview !== null && (
        <RemoteSkillPreview
          skill={preview.skill}
          repoLabel={preview.repoLabel}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
}
