"use client";

import ReactMarkdown from "react-markdown";
import type { ReactNode } from "react";
import remarkGfm from "remark-gfm";
import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import { createHighlighterCoreSync } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import githubDark from "shiki/themes/github-dark.mjs";
import bash from "shiki/langs/bash.mjs";
import shell from "shiki/langs/shell.mjs";
import json from "shiki/langs/json.mjs";
import yaml from "shiki/langs/yaml.mjs";
import typescript from "shiki/langs/typescript.mjs";
import tsx from "shiki/langs/tsx.mjs";
import javascript from "shiki/langs/javascript.mjs";
import jsx from "shiki/langs/jsx.mjs";
import python from "shiki/langs/python.mjs";
import markdown from "shiki/langs/markdown.mjs";
import diff from "shiki/langs/diff.mjs";
import sql from "shiki/langs/sql.mjs";
import { slugifyHeading } from "@/lib/markdown";

interface SkillMarkdownProps {
  content: string;
}

const highlighter = createHighlighterCoreSync({
  themes: [githubDark],
  langs: [bash, shell, json, yaml, typescript, tsx, javascript, jsx, python, markdown, diff, sql],
  engine: createJavaScriptRegexEngine(),
});

function normalizeLanguage(language: string) {
  const lang = language.toLowerCase();
  if (!lang) return "text";
  if (lang === "sh" || lang === "zsh") return "bash";
  if (lang === "yml") return "yaml";
  if (lang === "py") return "python";
  if (lang === "js") return "javascript";
  if (lang === "ts") return "typescript";
  if (lang === "md") return "markdown";
  return lang;
}

function extractNodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractNodeText).join("");
  }
  if (node && typeof node === "object" && "props" in node) {
    return extractNodeText((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
}

function CodeBlock({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [highlighted, setHighlighted] = useState("");
  const language = className?.replace("language-", "") || "";
  const normalizedLanguage = normalizeLanguage(language);

  useEffect(() => {
    try {
      const html = highlighter.codeToHtml(children, {
        lang: normalizedLanguage,
        theme: "github-dark",
      });
      setHighlighted(html);
    } catch {
      setHighlighted("");
    }
  }, [children, normalizedLanguage]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleCopy}
          className="rounded bg-[#3c3156] p-1.5 text-[#efe8fb] hover:bg-[#2f2545]"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      {language && (
        <div className="absolute left-3 top-0 -translate-y-1/2 rounded bg-[#3c3156] px-2 py-0.5 text-xs text-[#efe8fb]">
          {language}
        </div>
      )}
      {highlighted ? (
        <div
          className="[&_.shiki]:!m-0 [&_.shiki]:overflow-x-auto [&_.shiki]:rounded-xl [&_.shiki]:border [&_.shiki]:border-[#d8caef] [&_.shiki]:bg-[#2b223d] [&_.shiki]:p-4 [&_.shiki]:shadow-inner [&_.shiki_code]:font-mono [&_.shiki_code]:text-[0.9rem] [&_.shiki_code]:leading-6"
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      ) : (
        <pre className="overflow-x-auto rounded-xl border border-[#d8caef] bg-[#2b223d] p-4 text-[#f4effd] shadow-inner">
          <code className={className}>{children}</code>
        </pre>
      )}
    </div>
  );
}

export function SkillMarkdown({ content }: SkillMarkdownProps) {
  const headingCount = new Map<string, number>();

  const getHeadingId = (text: string) => {
    const baseId = slugifyHeading(text) || "section";
    const count = headingCount.get(baseId) ?? 0;
    headingCount.set(baseId, count + 1);
    return count === 0 ? baseId : `${baseId}-${count}`;
  };

  return (
    <div className="prose prose-lg max-w-none text-[#372d4b] prose-headings:scroll-mt-20 prose-headings:text-[#201730] prose-p:text-[#514763] prose-strong:text-[#201730] prose-lead:text-[#5f5571] prose-a:text-[#0f8a78] prose-a:no-underline hover:prose-a:text-[#0a6d5f] prose-hr:border-[#ddd2ee] prose-blockquote:border-l-[#7c62b7] prose-blockquote:bg-[#f4ecff] prose-blockquote:px-5 prose-blockquote:py-3 prose-blockquote:text-[#5b536d] prose-code:text-[#0f8a78] prose-code:before:content-none prose-code:after:content-none prose-pre:p-0 prose-pre:bg-transparent prose-li:text-[#514763] prose-ul:my-4 prose-ol:my-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ children, className, ...props }) {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="rounded-md border border-[#dfd3f1] bg-[#f2eaff] px-1.5 py-0.5 text-[0.95em] text-[#0f8a78]" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <CodeBlock className={className}>
                {String(children).replace(/\n$/, "")}
              </CodeBlock>
            );
          },
          h1: () => null, // Skip h1, shown in header
          h2: ({ children }) => (
            <h2
              id={getHeadingId(extractNodeText(children))}
              className="mt-10 mb-5 scroll-mt-24 border-b border-[#ddd2ee] pb-3 text-xl font-bold tracking-tight text-[#201730]"
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              id={getHeadingId(extractNodeText(children))}
              className="mt-8 mb-3 scroll-mt-24 text-lg font-semibold text-[#2d2340]"
            >
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="my-4 leading-8 text-[#514763]">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="my-4 list-disc space-y-2 pl-6 marker:text-[#7c62b7]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-4 list-decimal space-y-3 pl-6 marker:font-semibold marker:text-[#7c62b7]">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1 text-[#514763]">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-6 rounded-r-2xl border-l-4 border-[#7c62b7] bg-[#f4ecff] px-5 py-4 italic text-[#5b536d]">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-6 overflow-hidden rounded-2xl border border-[#ddd2ee] bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="m-0 w-full border-collapse text-left text-sm">
                  {children}
                </table>
              </div>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[#f4ecff] text-[#2d2340]">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border-b border-[#ddd2ee] px-4 py-3 font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-[#eee6f8] px-4 py-3 align-top text-[#514763]">
              {children}
            </td>
          ),
          hr: () => <hr className="my-8 border-0 border-t border-[#ddd2ee]" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
