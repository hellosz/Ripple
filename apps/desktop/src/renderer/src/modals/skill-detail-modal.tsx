import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { AiPatch, AiScoreResult, AiSuggestResult } from '@ripple/contract';
import { DiffBlock, ScoreCard, SuggestList } from '../components/ai-panels.js';
import { FileViewer } from '../components/file-viewer.js';
import type { SkillFileEntry } from '../components/file-viewer.js';
import { ScenarioPanel } from '../components/scenario-panel.js';
import { UninstallModal } from './uninstall-modal.js';
import { ripple } from '../ripple-api.js';
import { errText, useStore } from '../store.js';
import { AMBER, DANGER, GREEN_DEEP, INK, MONO, PRIMARY, dim, gradBtn, originLabel, outlineBtn } from '../ui.js';

type AiView = 'files' | 'score' | 'optimize' | 'scenario';

/** 优化视图：建议清单 + patch diff（应用 / 全部应用 / 放弃） */
function OptimizePanel({
  result,
  files,
  applied,
  applying,
  onApply,
  onDiscard,
}: {
  result: AiSuggestResult;
  files: SkillFileEntry[];
  /** 已应用的 patch 路径集合 */
  applied: Record<string, boolean>;
  applying: boolean;
  onApply: (patches: AiPatch[]) => void;
  onDiscard: () => void;
}): ReactElement {
  const pending = result.patches.filter((p) => !applied[p.path]);
  const contentOf = (path: string): string => files.find((f) => f.path === path)?.content ?? '';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flex: 'none' }}>
        <span style={{ fontWeight: 900, fontSize: 13.5, color: INK }}>优化建议</span>
        {result.source === 'fallback' && (
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              padding: '2px 9px',
              borderRadius: 999,
              background: 'rgba(169,138,91,.12)',
              color: AMBER,
              whiteSpace: 'nowrap',
            }}
          >
            未配置 AI，以下为本地规则建议
          </span>
        )}
        <span style={{ flex: 1 }} />
        {pending.length > 0 && (
          <span
            className="rp-btn-grad"
            onClick={() => onApply(pending)}
            style={{ ...gradBtn, fontSize: 11.5, padding: '5px 14px', flex: 'none', opacity: applying ? 0.5 : undefined }}
          >
            {applying ? '应用中…' : `全部应用 (${pending.length})`}
          </span>
        )}
        <span
          className="rp-btn-outline"
          onClick={onDiscard}
          style={{ ...outlineBtn, fontSize: 11.5, padding: '5px 14px', flex: 'none' }}
        >
          放弃
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
        <SuggestList result={result} />
        {result.patches.map((p) => {
          const done = !!applied[p.path];
          const current = contentOf(p.path);
          return (
            <div
              key={p.path}
              style={{
                border: '1px solid rgba(63,68,56,.1)',
                borderRadius: 12,
                marginBottom: 12,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 14px',
                  background: 'rgba(63,68,56,.03)',
                  borderBottom: '1px solid rgba(63,68,56,.07)',
                }}
              >
                <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: INK, whiteSpace: 'nowrap' }}>
                  {p.path}
                </span>
                {current === '' && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 8px',
                      borderRadius: 999,
                      background: 'rgba(127,165,136,.12)',
                      color: GREEN_DEEP,
                      whiteSpace: 'nowrap',
                      flex: 'none',
                    }}
                  >
                    新文件
                  </span>
                )}
                <span style={{ flex: 1 }} />
                {done ? (
                  <span style={{ fontSize: 11.5, color: GREEN_DEEP, fontWeight: 700, flex: 'none' }}>✓ 已应用</span>
                ) : (
                  <span
                    className="rp-btn-outline"
                    onClick={() => onApply([p])}
                    style={{
                      ...outlineBtn,
                      fontSize: 11,
                      padding: '4px 12px',
                      flex: 'none',
                      opacity: applying ? 0.5 : undefined,
                    }}
                  >
                    应用
                  </span>
                )}
              </div>
              <p style={{ margin: 0, padding: '8px 14px', fontSize: 12, color: dim(0.55), lineHeight: 1.7 }}>
                {p.rationale}
              </p>
              <div style={{ padding: '0 10px 10px' }}>
                <DiffBlock oldText={current} newText={p.new_content} />
              </div>
            </div>
          );
        })}
        {result.patches.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 0 30px', color: dim(0.4), fontSize: 12 }}>
            无可应用的文件补丁
          </div>
        )}
      </div>
    </div>
  );
}

/** 本地 Skill 详情：左侧文件树 + 右侧 VSCode 风格内容区，支持编辑保存（写回 SSOT 并重建复制型分发）；
 * 头部提供「评分」「优化」AI 入口（结果在弹窗生命周期内缓存） */
export function SkillDetailModal(): ReactElement | null {
  const store = useStore();
  const { snapshot, skillDetail } = store;
  const [files, setFiles] = useState<SkillFileEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ---- AI：评分 / 优化（缓存于弹窗生命周期） ----
  const [aiView, setAiView] = useState<AiView>('files');
  const [score, setScore] = useState<AiScoreResult | null>(null);
  const [scoring, setScoring] = useState(false);
  const [suggest, setSuggest] = useState<AiSuggestResult | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [applied, setApplied] = useState<Record<string, boolean>>({});
  const [applying, setApplying] = useState(false);
  const [uninstallOpen, setUninstallOpen] = useState(false);

  const skill = skillDetail;

  const load = useCallback(async (name: string): Promise<void> => {
    try {
      setFiles(await ripple.readSkillFiles(name));
      setError(null);
    } catch (err) {
      setError(errText(err));
    }
  }, []);

  useEffect(() => {
    setFiles(null);
    setError(null);
    setAiView('files');
    setScore(null);
    setScoring(false);
    setSuggest(null);
    setOptimizing(false);
    setApplied({});
    setApplying(false);
    setUninstallOpen(false);
    if (skill) void load(skill);
  }, [skill, load]);

  if (!skill) return null;

  const meta = snapshot?.skills[skill];
  const origin = snapshot?.installs.find((i) => i.skill === skill)?.origin;
  const close = (): void => store.setSkillDetail(null);
  const loadAsset = (path: string): Promise<{ base64: string; mime: string; size: number }> =>
    ripple.readSkillAsset(skill, path);
  const goAiSettings = (): void => {
    close();
    store.setSettingsTab('ai');
    store.setView({ kind: 'settings' });
  };

  const onSave = async (path: string, content: string): Promise<void> => {
    try {
      await ripple.writeSkillFile(skill, path, content);
      await load(skill);
      await store.refresh();
      store.toast(`已保存 ${path}，复制型分发已重建`);
    } catch (err) {
      store.toast(`保存失败：${errText(err)}`);
      throw err;
    }
  };

  const runScore = (force: boolean): void => {
    if (scoring) return;
    if (score && !force) {
      // 已评分：直接展示缓存结果
      setAiView('score');
      return;
    }
    setAiView('score');
    setScoring(true);
    void (async () => {
      try {
        setScore(await ripple.aiScore(skill));
      } catch (err) {
        store.toast(`评分失败：${errText(err)}`);
        if (!score) setAiView('files');
      } finally {
        setScoring(false);
      }
    })();
  };

  const runOptimize = (): void => {
    if (optimizing) return;
    if (suggest) {
      // 已生成：直接展示缓存结果
      setAiView('optimize');
      return;
    }
    setAiView('optimize');
    setOptimizing(true);
    void (async () => {
      try {
        setSuggest(await ripple.aiOptimize(skill));
        setApplied({});
      } catch (err) {
        store.toast(`优化失败：${errText(err)}`);
        setAiView('files');
      } finally {
        setOptimizing(false);
      }
    })();
  };

  const applyPatches = (patches: AiPatch[]): void => {
    if (applying || patches.length === 0) return;
    setApplying(true);
    void (async () => {
      try {
        const { applied: n } = await ripple.aiApplyPatches(skill, patches);
        setApplied((m) => {
          const next = { ...m };
          for (const p of patches) next[p.path] = true;
          return next;
        });
        await load(skill);
        await store.refresh();
        store.toast(`已应用 ${n} 个补丁，复制型分发已重建`);
      } catch (err) {
        store.toast(`应用补丁失败：${errText(err)}`);
      } finally {
        setApplying(false);
      }
    })();
  };

  const discardOptimize = (): void => {
    setSuggest(null);
    setApplied({});
    setAiView('files');
  };

  const headBtn = (label: string, busyLabel: string, busy: boolean, active: boolean, onClick: () => void): ReactElement => (
    <span
      className="rp-btn-outline"
      onClick={onClick}
      style={{
        ...outlineBtn,
        fontSize: 11.5,
        padding: '4px 13px',
        flex: 'none',
        opacity: busy ? 0.55 : undefined,
        background: active ? 'rgba(147,168,107,.12)' : undefined,
      }}
    >
      {busy ? busyLabel : label}
    </span>
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
          width: 900,
          maxWidth: '94vw',
          height: 640,
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 20px 50px rgba(63,68,56,.2)',
          animation: 'slide-up .25s cubic-bezier(.16,1,.3,1)',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 22px 12px', flex: 'none' }}>
          <span style={{ fontWeight: 900, fontSize: 16, color: INK, whiteSpace: 'nowrap' }}>{skill}</span>
          {meta?.version && (
            <span style={{ fontFamily: MONO, fontSize: 12, color: PRIMARY, whiteSpace: 'nowrap' }}>
              v{meta.version}
            </span>
          )}
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
            {originLabel(origin)}
          </span>
          <span
            style={{
              fontSize: 12,
              color: dim(0.45),
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
              flex: 1,
            }}
          >
            {meta?.description ?? ''}
          </span>
          {aiView !== 'files' &&
            headBtn('← 返回文件', '', false, false, () => setAiView('files'))}
          {headBtn('评分', '评分中…', scoring, aiView === 'score', () => runScore(false))}
          {headBtn('优化', '生成中…', optimizing, aiView === 'optimize', runOptimize)}
          {headBtn('场景', '', false, aiView === 'scenario', () => setAiView('scenario'))}
          <span
            className="rp-hover-danger"
            onClick={() => setUninstallOpen(true)}
            title="卸载技能（整技能或指定 Agent）"
            style={{
              border: '1px solid rgba(189,133,120,.4)',
              color: DANGER,
              fontWeight: 700,
              fontSize: 11.5,
              borderRadius: 8,
              padding: '4px 13px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flex: 'none',
            }}
          >
            卸载
          </span>
          <span
            className="rp-hover-primary"
            onClick={close}
            style={{ color: dim(0.4), cursor: 'pointer', fontSize: 15, flex: 'none', padding: '0 2px' }}
          >
            ✕
          </span>
        </div>
        <div style={{ flex: 1, minHeight: 0, padding: '0 22px 18px' }}>
          {aiView === 'scenario' && (
            <ScenarioPanel
              skill={skill}
              onGoAiSettings={goAiSettings}
              onTagClick={(tag) => {
                // 关详情 → 回本地列表并按该标签过滤
                store.setSkillDetail(null);
                store.setView({ kind: 'local' });
                store.setQuery(tag);
              }}
            />
          )}
          {aiView === 'score' && score !== null && !scoring && (
            <ScoreCard result={score} scoring={scoring} onRescore={() => runScore(true)} />
          )}
          {aiView === 'score' && (score === null || scoring) && (
            <div style={{ textAlign: 'center', padding: '120px 0', color: dim(0.45), fontSize: 13 }}>
              评分中…
              <div style={{ fontSize: 11.5, marginTop: 8, color: dim(0.35) }}>正在按 6 维 rubric 分析技能内容</div>
            </div>
          )}
          {aiView === 'optimize' && suggest !== null && !optimizing && (
            <OptimizePanel
              result={suggest}
              files={files ?? []}
              applied={applied}
              applying={applying}
              onApply={applyPatches}
              onDiscard={discardOptimize}
            />
          )}
          {aiView === 'optimize' && (suggest === null || optimizing) && (
            <div style={{ textAlign: 'center', padding: '120px 0', color: dim(0.45), fontSize: 13 }}>
              生成优化建议中…
              <div style={{ fontSize: 11.5, marginTop: 8, color: dim(0.35) }}>
                正在分析技能并生成建议与补丁，可能需要一两分钟
              </div>
            </div>
          )}
          {aiView === 'files' && (
            <>
              {files === null && error === null && (
                <div style={{ textAlign: 'center', padding: '120px 0', color: dim(0.45), fontSize: 13 }}>
                  正在读取技能文件…
                </div>
              )}
              {error !== null && (
                <div style={{ textAlign: 'center', padding: '120px 0', color: DANGER, fontSize: 13 }}>
                  读取失败：{error}
                </div>
              )}
              {files !== null && (
                <FileViewer files={files} height="100%" onSave={onSave} loadAsset={loadAsset} />
              )}
            </>
          )}
        </div>
      </div>
      {uninstallOpen && (
        <UninstallModal skill={skill} onClose={() => setUninstallOpen(false)} onDone={close} />
      )}
    </div>
  );
}
