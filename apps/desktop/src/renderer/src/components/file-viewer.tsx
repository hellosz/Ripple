import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import { MONO, dim, fmtBytes } from '../ui.js';
import { MarkdownView } from './markdown.js';
import type { AssetLoader } from './markdown.js';

export interface SkillFileEntry {
  path: string;
  content: string;
  size: number;
  /** 二进制/超限文件：仅有条目，内容经 loadAsset 按需读取预览 */
  binary?: boolean;
}

/** VSCode 风格代码区配色（橄榄调深色底） */
const CODE_BG = '#23271f';
const CODE_HEADER_BG = '#2b3026';
const CODE_FG = '#d8dbc9';
const CODE_LINE_NO = 'rgba(216,219,201,.28)';

const LANG_BY_EXT: Record<string, string> = {
  md: 'Markdown',
  ts: 'TypeScript',
  tsx: 'TypeScript',
  js: 'JavaScript',
  mjs: 'JavaScript',
  jsx: 'JavaScript',
  json: 'JSON',
  py: 'Python',
  sh: 'Shell',
  bash: 'Shell',
  yml: 'YAML',
  yaml: 'YAML',
  toml: 'TOML',
  css: 'CSS',
  html: 'HTML',
  txt: '纯文本',
};

export function langOf(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return LANG_BY_EXT[ext] ?? '纯文本';
}

const isMarkdown = (path: string): boolean => path.toLowerCase().endsWith('.md');

const dirOf = (path: string): string => {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
};

const baseOf = (path: string): string => {
  const i = path.lastIndexOf('/');
  return i < 0 ? path : path.slice(i + 1);
};

interface TreeGroup {
  dir: string;
  files: SkillFileEntry[];
}

/** 目录分组：根目录在前（SKILL.md 置顶），其余目录按名称排序 */
function groupFiles(files: SkillFileEntry[]): TreeGroup[] {
  const byDir = new Map<string, SkillFileEntry[]>();
  for (const f of files) {
    const dir = dirOf(f.path);
    const list = byDir.get(dir) ?? [];
    list.push(f);
    byDir.set(dir, list);
  }
  const dirs = [...byDir.keys()].sort((a, b) => {
    if (a === '') return -1;
    if (b === '') return 1;
    return a < b ? -1 : 1;
  });
  return dirs.map((dir) => ({
    dir,
    files: (byDir.get(dir) ?? []).sort((a, b) => {
      if (a.path === 'SKILL.md') return -1;
      if (b.path === 'SKILL.md') return 1;
      return a.path < b.path ? -1 : 1;
    }),
  }));
}

/** 通用素材预览：图片内联、PDF 内嵌、其余显示类型与大小 */
function AssetPreview({ file, loadAsset }: { file: SkillFileEntry; loadAsset?: AssetLoader }): ReactElement {
  const [asset, setAsset] = useState<{ base64: string; mime: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAsset(null);
    setError(null);
    if (!loadAsset) return;
    let alive = true;
    loadAsset(file.path)
      .then((a) => {
        if (alive) setAsset(a);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      alive = false;
    };
  }, [file.path, loadAsset]);

  const infoBox = (title: string, detail: string): ReactElement => (
    <div style={{ textAlign: 'center', color: 'rgba(216,219,201,.55)' }}>
      <div style={{ fontSize: 34, marginBottom: 10 }}>▦</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: CODE_FG }}>{title}</div>
      <div style={{ fontSize: 11.5, marginTop: 6, fontFamily: MONO }}>{detail}</div>
    </div>
  );

  let body: ReactElement;
  if (error !== null) {
    body = infoBox(baseOf(file.path), `读取失败：${error}`);
  } else if (!loadAsset) {
    body = infoBox(baseOf(file.path), `二进制文件 · ${fmtBytes(file.size)}`);
  } else if (asset === null) {
    body = <div style={{ color: 'rgba(216,219,201,.45)', fontSize: 12.5 }}>正在读取素材…</div>;
  } else if (asset.mime.startsWith('image/')) {
    body = (
      <img
        src={`data:${asset.mime};base64,${asset.base64}`}
        alt={file.path}
        style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, objectFit: 'contain' }}
      />
    );
  } else if (asset.mime === 'application/pdf') {
    body = (
      <iframe
        title={file.path}
        src={`data:application/pdf;base64,${asset.base64}`}
        style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8, background: '#ffffff' }}
      />
    );
  } else {
    body = infoBox(baseOf(file.path), `${asset.mime} · ${fmtBytes(file.size)}`);
  }

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        overflow: 'auto',
      }}
    >
      {body}
    </div>
  );
}

export interface FileViewerProps {
  files: SkillFileEntry[];
  /** 内容区高度（px 或 '100%'）；组件自身占满宽度 */
  height: number | string;
  /** 传入 onSave 即启用编辑模式（右上「编辑」按钮） */
  onSave?: (path: string, content: string) => Promise<void>;
  /** 素材读取器（图片/PDF 等二进制预览与 Markdown 内联图片） */
  loadAsset?: AssetLoader;
}

/** 技能文件浏览器：左侧文件树 + 右侧内容区；Markdown 预览渲染样式（可切原文），二进制素材内联预览 */
export function FileViewer({ files, height, onSave, loadAsset }: FileViewerProps): ReactElement {
  const groups = useMemo(() => groupFiles(files), [files]);
  const [activePath, setActivePath] = useState<string>(
    files.some((f) => f.path === 'SKILL.md') ? 'SKILL.md' : (files[0]?.path ?? ''),
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  /** Markdown 显示方式：预览渲染 / 原文 */
  const [mdRaw, setMdRaw] = useState(false);

  // 文件列表变化（如保存后重载）时校正选中项
  useEffect(() => {
    if (files.length > 0 && !files.some((f) => f.path === activePath)) {
      setActivePath(files.some((f) => f.path === 'SKILL.md') ? 'SKILL.md' : (files[0]?.path ?? ''));
      setEditing(false);
    }
  }, [files, activePath]);

  const active = files.find((f) => f.path === activePath) ?? null;
  const activeIsMd = active !== null && !active.binary && isMarkdown(active.path);
  const showRendered = activeIsMd && !mdRaw && !editing;

  const select = (path: string): void => {
    if (editing) return; // 编辑中不切换，避免误丢改动
    setActivePath(path);
  };

  const startEdit = (): void => {
    if (!active) return;
    setDraft(active.content);
    setEditing(true);
  };

  const save = (): void => {
    if (!onSave || !active || saving) return;
    setSaving(true);
    void onSave(active.path, draft)
      .then(() => setEditing(false))
      .finally(() => setSaving(false));
  };

  const fileRow = (f: SkillFileEntry, indent: boolean): ReactElement => {
    const on = f.path === activePath;
    const core = f.path === 'SKILL.md';
    return (
      <div
        key={f.path}
        className="rp-hover-row"
        onClick={() => select(f.path)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          padding: `5px 8px 5px ${indent ? 20 : 8}px`,
          borderRadius: 7,
          cursor: editing ? 'not-allowed' : 'pointer',
          color: on ? '#3f4438' : dim(0.6),
          background: on ? 'rgba(147,168,107,.16)' : undefined,
          fontWeight: on ? 700 : undefined,
          fontFamily: MONO,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        <span style={{ flex: 'none', fontSize: 11, opacity: 0.6 }}>{f.binary ? '▦' : '▤'}</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{baseOf(f.path)}</span>
        {core && (
          <span
            style={{
              flex: 'none',
              fontSize: 9.5,
              fontWeight: 800,
              padding: '1px 6px',
              borderRadius: 999,
              background: 'rgba(107,127,67,.14)',
              color: '#6b7f43',
              fontFamily: "'Noto Sans SC',sans-serif",
            }}
          >
            核心
          </span>
        )}
      </div>
    );
  };

  const btnStyle: CSSProperties = {
    fontSize: 11.5,
    fontWeight: 700,
    padding: '4px 12px',
    borderRadius: 7,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flex: 'none',
  };

  const segChip = (label: string, on: boolean, onClick: () => void): ReactElement => (
    <span
      onClick={onClick}
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        padding: '2px 10px',
        borderRadius: 999,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flex: 'none',
        background: on ? 'rgba(147,168,107,.28)' : 'transparent',
        color: on ? '#e6e9d8' : 'rgba(216,219,201,.5)',
        border: `1px solid ${on ? 'rgba(147,168,107,.5)' : 'rgba(216,219,201,.2)'}`,
      }}
    >
      {label}
    </span>
  );

  const lines = active && !active.binary ? active.content.split('\n') : [];

  return (
    <div
      style={{
        display: 'flex',
        height,
        border: '1px solid rgba(63,68,56,.1)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {/* 文件树 */}
      <div
        style={{
          width: 200,
          flex: 'none',
          overflowY: 'auto',
          background: '#f4f2e8',
          borderRight: '1px solid rgba(63,68,56,.08)',
          padding: 8,
        }}
      >
        {groups.map((g) => (
          <div key={g.dir || '(root)'}>
            {g.dir !== '' && (
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: dim(0.4),
                  padding: '8px 8px 3px',
                  fontFamily: MONO,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                ▸ {g.dir}/
              </div>
            )}
            {g.files.map((f) => fileRow(f, g.dir !== ''))}
          </div>
        ))}
        {files.length === 0 && (
          <div style={{ fontSize: 12, color: dim(0.4), padding: 12, textAlign: 'center' }}>无文件</div>
        )}
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: CODE_BG }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 14px',
            background: CODE_HEADER_BG,
            borderBottom: '1px solid rgba(0,0,0,.25)',
            flex: 'none',
          }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: 12,
              fontWeight: 700,
              color: CODE_FG,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
            }}
          >
            {active?.path ?? '—'}
          </span>
          {active && (
            <span style={{ fontSize: 10.5, color: 'rgba(216,219,201,.5)', whiteSpace: 'nowrap', flex: 'none' }}>
              {active.binary ? '素材' : langOf(active.path)} · {fmtBytes(active.size)}
            </span>
          )}
          <span style={{ flex: 1 }} />
          {activeIsMd && !editing && (
            <>
              {segChip('预览', !mdRaw, () => setMdRaw(false))}
              {segChip('原文', mdRaw, () => setMdRaw(true))}
            </>
          )}
          {onSave && active && !active.binary && !editing && (
            <span
              onClick={startEdit}
              style={{ ...btnStyle, border: '1px solid rgba(216,219,201,.35)', color: CODE_FG }}
            >
              编辑
            </span>
          )}
          {onSave && editing && (
            <>
              <span
                onClick={() => setEditing(false)}
                style={{ ...btnStyle, border: '1px solid rgba(216,219,201,.25)', color: 'rgba(216,219,201,.6)' }}
              >
                取消
              </span>
              <span
                onClick={save}
                style={{
                  ...btnStyle,
                  background: '#93a86b',
                  color: '#ffffff',
                  opacity: saving ? 0.6 : undefined,
                }}
              >
                {saving ? '保存中…' : '保存'}
              </span>
            </>
          )}
        </div>

        {active?.binary ? (
          <AssetPreview file={active} loadAsset={loadAsset} />
        ) : editing && active ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            style={{
              flex: 1,
              minHeight: 0,
              resize: 'none',
              border: 'none',
              outline: 'none',
              background: CODE_BG,
              color: CODE_FG,
              fontFamily: MONO,
              fontSize: 12,
              lineHeight: 1.65,
              padding: '10px 14px',
              userSelect: 'text',
            }}
          />
        ) : showRendered && active ? (
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#faf9f2' }}>
            <MarkdownView content={active.content} loadAsset={loadAsset} />
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <div style={{ display: 'flex', minWidth: 'fit-content' }}>
              {/* 行号列 */}
              <div
                aria-hidden
                style={{
                  flex: 'none',
                  textAlign: 'right',
                  padding: '10px 10px 14px 14px',
                  color: CODE_LINE_NO,
                  fontFamily: MONO,
                  fontSize: 12,
                  lineHeight: 1.65,
                  userSelect: 'none',
                  borderRight: '1px solid rgba(216,219,201,.08)',
                }}
              >
                {lines.map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: '10px 16px 14px 12px',
                  color: CODE_FG,
                  fontFamily: MONO,
                  fontSize: 12,
                  lineHeight: 1.65,
                  whiteSpace: 'pre',
                  userSelect: 'text',
                }}
              >
                {active?.content ?? ''}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
