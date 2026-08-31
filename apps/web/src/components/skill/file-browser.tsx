'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { FileContent, FileTreeNode } from '@ripple/contract';
import { apiClient } from '@/lib/api';
import { copyText, fmtCount } from '@/lib/format';
import { useToast } from '@/components/providers/toast-context';
import { CodeFile, MarkdownFile } from './markdown';

function fmtSize(bytes: number | undefined): string {
  if (bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

interface FlatRow {
  node: FileTreeNode;
  depth: number;
}

function flatten(nodes: FileTreeNode[], openDirs: Record<string, boolean>, depth = 0): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const node of nodes) {
    rows.push({ node, depth });
    if (node.type === 'directory' && openDirs[node.path] !== false && node.children) {
      rows.push(...flatten(node.children, openDirs, depth + 1));
    }
  }
  return rows;
}

/** 文件树浏览器：目录展开、md 渲染、代码高亮、复制源码 */
export function FileBrowser({ slug }: { slug: string }): ReactElement {
  const { showToast } = useToast();
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [openDirs, setOpenDirs] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<FileContent | null>(null);
  const [loadingPath, setLoadingPath] = useState<string | null>(null);

  const openFile = useCallback(
    async (path: string) => {
      setLoadingPath(path);
      try {
        const file = await apiClient().skills.file(slug, path);
        setSelected(file);
      } catch {
        showToast('文件加载失败');
      } finally {
        setLoadingPath(null);
      }
    },
    [slug, showToast],
  );

  useEffect(() => {
    let cancelled = false;
    void apiClient()
      .skills.files(slug)
      .then((nodes) => {
        if (cancelled) return;
        setTree(nodes);
        const first =
          nodes.find((n) => n.type === 'file' && n.name.toUpperCase() === 'SKILL.MD') ??
          nodes.find((n) => n.type === 'file');
        if (first) void openFile(first.path);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [slug, openFile]);

  const rows = flatten(tree, openDirs);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '210px 1fr',
        border: '1px solid rgba(63,68,56,.09)',
        borderRadius: 14,
        overflow: 'hidden',
        background: 'rgba(63,68,56,.015)',
        height: 480,
      }}
    >
      <div style={{ borderRight: '1px solid rgba(63,68,56,.07)', background: 'rgba(63,68,56,.02)', padding: '10px 8px', overflowY: 'auto' }}>
        {rows.map(({ node, depth }) => {
          const isDir = node.type === 'directory';
          const open = openDirs[node.path] !== false;
          const active = selected?.path === node.path;
          return (
            <div
              key={node.path}
              className="rp-tree-row"
              onClick={() => {
                if (isDir) setOpenDirs((prev) => ({ ...prev, [node.path]: !(prev[node.path] !== false) }));
                else void openFile(node.path);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 10px',
                paddingLeft: 10 + depth * 18,
                borderRadius: 8,
                cursor: 'pointer',
                fontFamily: 'var(--rp-font-mono)',
                fontSize: 12.5,
                marginBottom: 1,
                color: isDir
                  ? 'rgba(75,80,64,.75)'
                  : active
                    ? 'var(--rp-ink)'
                    : 'rgba(107,127,67,.75)',
                background: active ? 'rgba(147,168,107,.22)' : undefined,
              }}
            >
              <span style={{ color: 'rgba(75,80,64,.3)', flex: 'none' }}>{isDir ? (open ? '▾' : '▸') : '▤'}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isDir ? `${node.name}/` : node.name}
              </span>
              {node.name.toUpperCase() === 'SKILL.MD' ? (
                <span
                  style={{
                    fontSize: 9.5,
                    padding: '1px 6px',
                    borderRadius: 999,
                    background: 'rgba(147,168,107,.16)',
                    color: 'var(--rp-primary)',
                    fontFamily: 'var(--rp-font-sans)',
                    whiteSpace: 'nowrap',
                    flex: 'none',
                  }}
                >
                  核心
                </span>
              ) : null}
            </div>
          );
        })}
        {rows.length === 0 ? (
          <div style={{ padding: 12, fontSize: 12, color: 'rgba(75,80,64,.4)' }}>暂无文件</div>
        ) : null}
      </div>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 16px',
            borderBottom: '1px solid rgba(63,68,56,.06)',
            fontFamily: 'var(--rp-font-mono)',
            fontSize: 11.5,
            color: 'rgba(75,80,64,.4)',
            flex: 'none',
          }}
        >
          <span>{selected ? selected.path : loadingPath ? `${loadingPath} 加载中…` : '选择左侧文件预览'}</span>
          {selected ? (
            <>
              <span>·</span>
              <span>{fmtSize(selected.size)}</span>
            </>
          ) : null}
          <span style={{ flex: 1 }} />
          {selected ? (
            <button
              type="button"
              onClick={() => {
                void copyText(selected.content).then(() => showToast(`已复制 ${selected.path} 源码`));
              }}
              style={{
                fontSize: 11,
                color: 'rgba(107,127,67,.9)',
                border: '1px solid rgba(147,168,107,.35)',
                borderRadius: 6,
                padding: '3px 10px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontFamily: 'var(--rp-font-sans)',
                background: 'none',
              }}
            >
              复制源码
            </button>
          ) : null}
        </div>
        <div style={{ padding: '16px 24px 22px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {selected ? (
            selected.path.toLowerCase().endsWith('.md') ? (
              <MarkdownFile source={selected.content} />
            ) : (
              <CodeFile content={selected.content} language={selected.language} />
            )
          ) : (
            <div style={{ fontSize: 13, color: 'rgba(75,80,64,.4)' }}>
              {loadingPath ? '加载中…' : `共 ${fmtCount(rows.length)} 个条目`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
