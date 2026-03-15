"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface SkillMarkdownProps {
  content: string;
}

function CodeBlock({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const language = className?.replace("language-", "") || "";

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
          className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      {language && (
        <div className="absolute left-3 top-0 -translate-y-1/2 px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded">
          {language}
        </div>
      )}
      <pre className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 overflow-x-auto">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

export function SkillMarkdown({ content }: SkillMarkdownProps) {
  return (
    <div className="prose prose-gray dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-h2:border-b prose-h2:border-gray-200 prose-h2:dark:border-gray-700 prose-h2:pb-2 prose-code:text-ripple-600 prose-code:dark:text-ripple-400 prose-pre:p-0 prose-pre:bg-transparent">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          code({ children, className, ...props }) {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-sm" {...props}>
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
            <h2 className="text-xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">
              {children}
            </h2>
          ),
          ul: ({ children }) => (
            <ul className="space-y-1 my-3">{children}</ul>
          ),
          li: ({ children }) => (
            <li className="flex items-start gap-2">
              <span className="text-ripple-500 mt-1.5 text-xs">&#9679;</span>
              <span>{children}</span>
            </li>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
