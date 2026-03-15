"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Share2 } from "lucide-react";
import Link from "next/link";
import type { SkillDetail as SkillDetailType, FileTreeNode } from "@/types";
import { SkillRating } from "./SkillRating";
import { SkillMarkdown } from "./SkillMarkdown";
import { SkillFileBrowser } from "./SkillFileBrowser";
import { SkillInstallCommand } from "./SkillInstallCommand";
import { SkillVersionHistory } from "./SkillVersionHistory";
import { LikeButton } from "@/components/interaction/LikeButton";
import { DownloadButton } from "@/components/interaction/DownloadButton";
import { RippleButton } from "@/components/interaction/RippleButton";
import { UserAvatar } from "@/components/user/UserAvatar";
import { ORIGIN_LABELS, CATEGORY_LABELS } from "@/lib/utils";
import { skills as skillsApi } from "@/lib/api";

interface SkillDetailComponentProps {
  skill: SkillDetailType;
}

function TypingText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("");
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayed("");
    indexRef.current = 0;
    const timer = setInterval(() => {
      if (indexRef.current < text.length) {
        setDisplayed(text.slice(0, indexRef.current + 1));
        indexRef.current++;
      } else {
        clearInterval(timer);
      }
    }, 50);
    return () => clearInterval(timer);
  }, [text]);

  return (
    <span>
      {displayed}
      {displayed.length < text.length && (
        <span className="typing-cursor" />
      )}
    </span>
  );
}

export function SkillDetailComponent({ skill }: SkillDetailComponentProps) {
  const [files, setFiles] = useState<FileTreeNode[]>([]);

  useEffect(() => {
    skillsApi.getFiles(skill.name).then(setFiles).catch(() => {});
  }, [skill.name]);

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
  };

  const categoryLabel =
    CATEGORY_LABELS[skill.category || ""] || skill.category || "Other";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <ArrowLeft size={16} />
          Back to list
        </Link>
        <div className="flex items-center gap-2">
          <RippleButton
            slug={skill.name}
            rippled={skill.user_rippled}
            downloaded={skill.user_downloaded}
            sizeTier={skill.stats.ripple_size_tier}
          />
          <LikeButton
            slug={skill.name}
            liked={skill.user_liked}
            sizeTier={skill.stats.like_size_tier}
          />
          <DownloadButton
            slug={skill.name}
            downloaded={skill.user_downloaded}
            sizeTier={skill.stats.download_size_tier}
          />
          <button
            onClick={handleShare}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
            title="Share"
          >
            <Share2 size={18} />
          </button>
        </div>
      </div>

      {/* Title Section */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <SkillRating rating={skill.rating} size="md" />
          <span className="text-xs text-gray-500">
            {ORIGIN_LABELS[skill.origin_type]}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {skill.display_name}
        </h1>
        <div className="flex flex-wrap gap-2 mt-2">
          {skill.tags?.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
            >
              {tag}
            </span>
          ))}
        </div>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          {skill.description}
        </p>
      </div>

      {/* Author recommendation */}
      {skill.recommendation && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-ripple-50 dark:bg-ripple-950/50 border border-ripple-200 dark:border-ripple-800">
          <UserAvatar user={skill.author} size={40} />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {skill.author.nickname || skill.author.email.split("@")[0]}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 relative bg-white dark:bg-gray-900 rounded-lg p-3 shadow-sm">
              <div className="absolute -left-2 top-3 w-0 h-0 border-t-[6px] border-t-transparent border-r-[8px] border-r-white dark:border-r-gray-900 border-b-[6px] border-b-transparent" />
              <TypingText text={skill.recommendation} />
            </div>
          </div>
        </div>
      )}

      {/* Install command */}
      <SkillInstallCommand skillName={skill.name} />

      {/* Summary */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div>
          <span className="text-gray-500">Category: </span>
          <span className="text-gray-900 dark:text-white font-medium">
            {categoryLabel}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Version: </span>
          <span className="text-gray-900 dark:text-white font-medium">
            v{skill.version}
          </span>
        </div>
      </div>

      {/* Markdown Content */}
      {skill.content && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Skill Content
          </h2>
          <SkillMarkdown content={skill.content} />
        </div>
      )}

      {/* File Browser */}
      {files.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <SkillFileBrowser slug={skill.name} files={files} />
        </div>
      )}

      {/* Version History */}
      {skill.versions.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <SkillVersionHistory versions={skill.versions} />
        </div>
      )}
    </div>
  );
}
