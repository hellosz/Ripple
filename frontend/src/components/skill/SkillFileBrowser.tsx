"use client";

import { useState } from "react";
import {
  Folder,
  File,
  ChevronRight,
  ChevronDown,
  Image,
  FileCode,
  FileText,
} from "lucide-react";
import { skills as skillsApi } from "@/lib/api";
import type { FileTreeNode, FileContent } from "@/types";
import { SkillMarkdown } from "./SkillMarkdown";

interface SkillFileBrowserProps {
  slug: string;
  files: FileTreeNode[];
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "svg"].includes(ext || "")) return Image;
  if (["md"].includes(ext || "")) return FileText;
  if (["py", "js", "ts", "tsx", "sh", "yaml", "yml", "json"].includes(ext || ""))
    return FileCode;
  return File;
}

function FileTreeItem({
  node,
  slug,
  depth = 0,
}: {
  node: FileTreeNode;
  slug: string;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(false);

  const isSkillMd = node.name === "SKILL.md";
  const Icon = node.type === "directory" ? Folder : getFileIcon(node.name);

  const handleClick = async () => {
    if (node.type === "directory") {
      setExpanded(!expanded);
      return;
    }
    if (isSkillMd) return; // Already displayed

    if (content) {
      setExpanded(!expanded);
      return;
    }

    setLoading(true);
    try {
      const data = await skillsApi.getFileContent(slug, node.path);
      setContent(data);
      setExpanded(true);
    } catch {
      // Ignore errors
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className={`w-full flex items-center gap-2 py-1.5 px-2 text-sm rounded-lg transition-colors hover:bg-[#efe7fa] ${
          isSkillMd ? "text-[#9a90ad]" : "text-[#3d3450]"
        }`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {node.type === "directory" ? (
          expanded ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )
        ) : (
          <span className="w-3.5" />
        )}
        <Icon
          size={14}
          className={
            node.type === "directory"
              ? "text-[#7c62b7]"
              : "text-[#9387ab]"
          }
        />
        <span className="truncate">{node.name}</span>
        {isSkillMd && (
          <span className="ml-auto text-xs text-[#0f8a78]">Displayed above</span>
        )}
        {loading && (
          <span className="ml-auto text-xs text-[#9387ab]">Loading...</span>
        )}
      </button>

      {expanded && node.type === "directory" && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              slug={slug}
              depth={depth + 1}
            />
          ))}
        </div>
      )}

      {expanded && content && !content.is_binary && (
        <div
          className="ml-8 my-2 overflow-hidden rounded-xl border border-[#ddd2ee] bg-white/65"
          style={{ marginLeft: `${depth * 20 + 32}px` }}
        >
          {content.language === "markdown" ? (
            <div className="p-4">
              <SkillMarkdown content={content.content} />
            </div>
          ) : (
            <pre className="overflow-x-auto bg-[#f8f4ff] p-4 text-sm text-[#372d4b]">
              <code>{content.content}</code>
            </pre>
          )}
        </div>
      )}

      {expanded && content && content.is_binary && (
        <div
          className="ml-8 my-2 p-4"
          style={{ marginLeft: `${depth * 20 + 32}px` }}
        >
          <img
            src={`data:image/*;base64,${content.content}`}
            alt={content.name}
            className="max-w-full rounded-lg"
          />
        </div>
      )}
    </div>
  );
}

export function SkillFileBrowser({ slug, files }: SkillFileBrowserProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold text-[#201730]">
        Files
      </h3>
      <div className="rounded-2xl border border-[#ddd2ee] bg-[linear-gradient(180deg,#fffdfd_0%,#f6f0ff_100%)] p-2 shadow-sm">
        {files.map((node) => (
          <FileTreeItem key={node.path} node={node} slug={slug} />
        ))}
      </div>
    </div>
  );
}
