import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { marked } from 'marked';

/** 素材加载器：相对路径 → base64+mime（来自 readSkillAsset）；失败返回 null */
export type AssetLoader = (path: string) => Promise<{ base64: string; mime: string } | null>;

const BLOCKED_TAGS = new Set(['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'STYLE', 'LINK', 'META', 'BASE']);

/** 轻量净化：本地技能内容渲染前移除脚本类节点、事件属性与 javascript: 链接 */
function sanitize(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const walk = (el: Element): void => {
    for (const child of [...el.children]) {
      if (BLOCKED_TAGS.has(child.tagName)) {
        child.remove();
        continue;
      }
      for (const attr of [...child.attributes]) {
        const name = attr.name.toLowerCase();
        const value = attr.value.trim().toLowerCase();
        if (name.startsWith('on')) child.removeAttribute(attr.name);
        else if ((name === 'href' || name === 'src') && value.startsWith('javascript:')) {
          child.removeAttribute(attr.name);
        }
      }
      walk(child);
    }
  };
  walk(doc.body);
  return doc.body.innerHTML;
}

/** 去掉 YAML frontmatter（渲染视图不展示原始头，编辑模式仍可见） */
function stripFrontmatter(md: string): { fm: string | null; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(md);
  if (!match) return { fm: null, body: md };
  return { fm: match[1] ?? null, body: md.slice(match[0].length) };
}

/** Markdown 渲染视图：marked 转 HTML + 净化；相对路径图片经 loadAsset 内联为 data URI */
export function MarkdownView({
  content,
  loadAsset,
}: {
  content: string;
  loadAsset?: AssetLoader;
}): ReactElement {
  const { fm, body } = useMemo(() => stripFrontmatter(content), [content]);
  const html = useMemo(() => sanitize(marked.parse(body, { async: false })), [body]);
  const [assetUris, setAssetUris] = useState<Record<string, string>>({});

  // 收集渲染结果中的相对图片路径并异步解析为 data URI
  const relImages = useMemo(() => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const paths: string[] = [];
    for (const img of doc.querySelectorAll('img')) {
      const src = img.getAttribute('src') ?? '';
      if (src && !/^(https?:|data:)/.test(src)) paths.push(src.replace(/^\.\//, ''));
    }
    return [...new Set(paths)];
  }, [html]);

  useEffect(() => {
    if (!loadAsset || relImages.length === 0) return;
    let alive = true;
    void (async () => {
      const next: Record<string, string> = {};
      for (const p of relImages) {
        try {
          const asset = await loadAsset(p);
          if (asset && asset.mime.startsWith('image/')) {
            next[p] = `data:${asset.mime};base64,${asset.base64}`;
          }
        } catch {
          /* 缺失素材保留占位 */
        }
      }
      if (alive) setAssetUris(next);
    })();
    return () => {
      alive = false;
    };
  }, [relImages, loadAsset]);

  const finalHtml = useMemo(() => {
    if (Object.keys(assetUris).length === 0) return html;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    for (const img of doc.querySelectorAll('img')) {
      const src = (img.getAttribute('src') ?? '').replace(/^\.\//, '');
      const uri = assetUris[src];
      if (uri) img.setAttribute('src', uri);
    }
    return doc.body.innerHTML;
  }, [html, assetUris]);

  return (
    <div style={{ padding: '14px 20px 20px' }}>
      {fm !== null && (
        <div
          style={{
            fontFamily: "'Space Grotesk',ui-monospace,monospace",
            fontSize: 11,
            lineHeight: 1.7,
            color: 'rgba(75,80,64,.55)',
            background: 'rgba(75,80,64,.05)',
            border: '1px solid rgba(63,68,56,.08)',
            borderRadius: 9,
            padding: '8px 12px',
            marginBottom: 14,
            whiteSpace: 'pre-wrap',
            userSelect: 'text',
          }}
        >
          {fm}
        </div>
      )}
      {/* 本地内容已净化（移除脚本/事件/js 链接） */}
      <div className="rp-md" dangerouslySetInnerHTML={{ __html: finalHtml }} />
    </div>
  );
}
