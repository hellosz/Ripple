import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { CommunitySkill } from '@ripple/hub';
import { FileViewer } from '../components/file-viewer.js';
import type { SkillFileEntry } from '../components/file-viewer.js';
import { ripple } from '../ripple-api.js';
import { errText } from '../store.js';
import { DANGER, INK, MONO, PRIMARY, dim } from '../ui.js';

/** 社区技能只读预览：已安装 → 本地文件树 + 渲染预览（无编辑）；未安装 → 元信息（安装后可浏览全部文件） */
export function CommunityPreviewModal({
  skill,
  sourceLabel,
  onClose,
}: {
  skill: CommunitySkill;
  sourceLabel: string;
  onClose: () => void;
}): ReactElement {
  const [files, setFiles] = useState<SkillFileEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFiles(null);
    setError(null);
    if (!skill.installed) return;
    let alive = true;
    ripple
      .readSkillFiles(skill.name)
      .then((list) => {
        if (alive) setFiles(list);
      })
      .catch((err: unknown) => {
        if (alive) setError(errText(err));
      });
    return () => {
      alive = false;
    };
  }, [skill.name, skill.installed]);

  const loadAsset = (path: string): Promise<{ base64: string; mime: string; size: number }> =>
    ripple.readSkillAsset(skill.name, path);

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
          width: skill.installed ? 880 : 520,
          maxWidth: '94vw',
          height: skill.installed ? 620 : undefined,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 22px 12px', flex: 'none' }}>
          <span style={{ fontWeight: 900, fontSize: 16, color: INK, whiteSpace: 'nowrap' }}>{skill.name}</span>
          <span style={{ fontFamily: MONO, fontSize: 12, color: PRIMARY, whiteSpace: 'nowrap' }}>
            v{skill.version}
          </span>
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
          <span
            style={{
              fontFamily: MONO,
              fontSize: 11.5,
              color: dim(0.4),
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
              flex: 1,
            }}
          >
            {sourceLabel}
          </span>
          <span
            className="rp-hover-primary"
            onClick={onClose}
            style={{ color: dim(0.4), cursor: 'pointer', fontSize: 15, flex: 'none', padding: '0 2px' }}
          >
            ✕
          </span>
        </div>

        {skill.installed ? (
          <div style={{ flex: 1, minHeight: 0, padding: '0 22px 18px' }}>
            {files === null && error === null && (
              <div style={{ textAlign: 'center', padding: '110px 0', color: dim(0.45), fontSize: 13 }}>
                正在读取技能文件…
              </div>
            )}
            {error !== null && (
              <div style={{ textAlign: 'center', padding: '110px 0', color: DANGER, fontSize: 13 }}>
                读取失败：{error}
              </div>
            )}
            {files !== null && <FileViewer files={files} height="100%" loadAsset={loadAsset} />}
          </div>
        ) : (
          <div style={{ padding: '0 24px 22px' }}>
            <p style={{ margin: '0 0 12px', fontSize: 12.5, lineHeight: 1.8, color: dim(0.6) }}>
              {skill.description || '暂无简介'}
            </p>
            {metaRow('来源仓库', sourceLabel)}
            {metaRow('内容指纹', skill.fingerprint.slice(0, 16))}
            {skill.remoteUpdatedAt !== null && metaRow('最近更新', skill.remoteUpdatedAt)}
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
              该技能尚未安装到本地：安装后可在此浏览完整文件树与渲染后的 SKILL.md。
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
