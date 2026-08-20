'use client';

import type { ReactElement } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';

/** Markdown 渲染（GFM + 代码高亮，样式见 globals.css 的 .rp-md） */
export function Markdown({ source }: { source: string }): ReactElement {
  return (
    <div className="rp-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {source}
      </ReactMarkdown>
    </div>
  );
}

/** 代码文件渲染：包一层 fence 走同一条高亮管线 */
export function CodeFile({ content, language }: { content: string; language: string | null }): ReactElement {
  const fence = '```';
  return <Markdown source={`${fence}${language ?? ''}\n${content}\n${fence}`} />;
}

/** 拆分 markdown 头部 frontmatter（用于文件预览的样式化展示） */
export function splitFrontmatter(source: string): { frontmatter: string[] | null; body: string } {
  const lines = source.split('\n');
  if (lines[0]?.trim() !== '---') return { frontmatter: null, body: source };
  const end = lines.slice(1).findIndex((l) => l.trim() === '---');
  if (end < 0) return { frontmatter: null, body: source };
  return { frontmatter: lines.slice(1, end + 1), body: lines.slice(end + 2).join('\n') };
}

/** Markdown 文件渲染：frontmatter 以独立样式块展示（对齐原型） */
export function MarkdownFile({ source }: { source: string }): ReactElement {
  const { frontmatter, body } = splitFrontmatter(source);
  return (
    <div>
      {frontmatter ? (
        <div
          style={{
            border: '1px solid rgba(147,168,107,.25)',
            borderRadius: 10,
            padding: '12px 16px',
            margin: '0 0 16px',
            background: 'rgba(147,168,107,.06)',
            fontFamily: 'var(--rp-font-mono)',
            fontSize: 12.5,
            lineHeight: 1.8,
          }}
        >
          {frontmatter.map((line, i) => {
            const ci = line.indexOf(':');
            return (
              <div key={i}>
                <span style={{ color: 'var(--rp-primary)' }}>{ci >= 0 ? line.slice(0, ci + 1) : line}</span>
                <span style={{ color: 'rgba(75,80,64,.65)' }}>{ci >= 0 ? line.slice(ci + 1) : ''}</span>
              </div>
            );
          })}
        </div>
      ) : null}
      <Markdown source={body} />
    </div>
  );
}
