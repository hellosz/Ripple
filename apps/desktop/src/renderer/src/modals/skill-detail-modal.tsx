import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { FileViewer } from '../components/file-viewer.js';
import type { SkillFileEntry } from '../components/file-viewer.js';
import { ripple } from '../ripple-api.js';
import { errText, useStore } from '../store.js';
import { DANGER, INK, MONO, PRIMARY, dim, originLabel } from '../ui.js';

/** 本地 Skill 详情：左侧文件树 + 右侧 VSCode 风格内容区，支持编辑保存（写回 SSOT 并重建复制型分发） */
export function SkillDetailModal(): ReactElement | null {
  const store = useStore();
  const { snapshot, skillDetail } = store;
  const [files, setFiles] = useState<SkillFileEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    if (skill) void load(skill);
  }, [skill, load]);

  if (!skill) return null;

  const meta = snapshot?.skills[skill];
  const origin = snapshot?.installs.find((i) => i.skill === skill)?.origin;
  const close = (): void => store.setSkillDetail(null);

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
          <span
            className="rp-hover-primary"
            onClick={close}
            style={{ color: dim(0.4), cursor: 'pointer', fontSize: 15, flex: 'none', padding: '0 2px' }}
          >
            ✕
          </span>
        </div>
        <div style={{ flex: 1, minHeight: 0, padding: '0 22px 18px' }}>
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
          {files !== null && <FileViewer files={files} height="100%" onSave={onSave} />}
        </div>
      </div>
    </div>
  );
}
