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
import { SkillComments } from "./SkillComments";
import { LikeButton } from "@/components/interaction/LikeButton";
import { DownloadButton } from "@/components/interaction/DownloadButton";
import { RippleButton } from "@/components/interaction/RippleButton";
import { UserAvatar } from "@/components/user/UserAvatar";
import { ORIGIN_LABELS, CATEGORY_LABELS } from "@/lib/utils";
import { skills as skillsApi } from "@/lib/api";
import { extractMarkdownHeadings } from "@/lib/markdown";

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
  const [localSkill, setLocalSkill] = useState(skill);
  const [files, setFiles] = useState<FileTreeNode[]>([]);
  const [activeHeadingId, setActiveHeadingId] = useState<string>("");
  const headings = localSkill.content ? extractMarkdownHeadings(localSkill.content) : [];

  useEffect(() => {
    setLocalSkill(skill);
  }, [skill]);

  useEffect(() => {
    skillsApi.getFiles(localSkill.name).then(setFiles).catch(() => {});
  }, [localSkill.name]);

  useEffect(() => {
    if (!headings.length) return;

    const headingElements = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((element): element is HTMLElement => element !== null);

    if (!headingElements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visibleEntries.length) {
          setActiveHeadingId(visibleEntries[0].target.id);
        }
      },
      {
        rootMargin: "-96px 0px -60% 0px",
        threshold: [0, 0.2, 0.5, 1],
      }
    );

    headingElements.forEach((element) => observer.observe(element));
    setActiveHeadingId(headingElements[0].id);

    return () => observer.disconnect();
  }, [headings]);

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
  };

  const refreshSkill = async () => {
    const latest = await skillsApi.refresh(localSkill.name);
    setLocalSkill(latest);
  };

  const handleTocClick = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    const element = document.getElementById(id);
    if (!element) return;

    element.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
    setActiveHeadingId(id);
  };

  const categoryLabel =
    CATEGORY_LABELS[localSkill.category || ""] || localSkill.category || "Other";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_240px]">
      <div className="rounded-[32px] border border-[#d9c9f1] bg-[linear-gradient(180deg,rgba(250,246,255,0.97)_0%,rgba(244,239,251,0.98)_100%)] p-6 text-[#241b38] shadow-[0_28px_100px_rgba(10,6,20,0.28)] md:p-8">
        <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-1 text-sm text-[#6d6482] transition-colors hover:text-[#2f2545]"
        >
          <ArrowLeft size={16} />
          Back to list
        </Link>
        <div className="flex items-center gap-2">
          <RippleButton
            slug={localSkill.name}
            rippled={localSkill.user_rippled}
            copied={localSkill.user_copied}
            liked={localSkill.user_liked}
            available={localSkill.ripple_available}
            sizeTier={localSkill.stats.ripple_size_tier}
            onUpdate={refreshSkill}
          />
          <LikeButton
            slug={localSkill.name}
            liked={localSkill.user_liked}
            sizeTier={localSkill.stats.like_size_tier}
            onUpdate={refreshSkill}
          />
          <DownloadButton
            slug={localSkill.name}
            downloaded={localSkill.user_downloaded}
            sizeTier={localSkill.stats.download_size_tier}
            onUpdate={refreshSkill}
          />
          <button
            onClick={handleShare}
            className="rounded-lg p-1.5 text-[#6d6482] transition-colors hover:bg-[#ebe3f6] hover:text-[#2f2545]"
            title="Share"
          >
            <Share2 size={18} />
          </button>
        </div>
      </div>

      {/* Title Section */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <SkillRating rating={localSkill.rating} size="md" />
          <span className="text-xs text-[#7d7391]">
            {ORIGIN_LABELS[localSkill.origin_type]}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-[#201730]">
          {localSkill.display_name}
        </h1>
        <div className="flex flex-wrap gap-2 mt-2">
          {localSkill.tags?.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[#d8cde9] bg-white/80 px-2 py-0.5 text-xs text-[#665d7b]"
            >
              {tag}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[#5b536d]">
          {localSkill.description}
        </p>
      </div>

      {/* Author recommendation */}
      {localSkill.recommendation && (
        <div className="flex items-start gap-3 rounded-2xl border border-[#d9c7f0] bg-[linear-gradient(180deg,#ffffff_0%,#f6efff_100%)] p-4 shadow-sm">
          <UserAvatar user={localSkill.author} size={40} />
          <div className="flex-1">
            <div className="text-sm font-medium text-[#201730]">
              {localSkill.author.nickname || localSkill.author.email.split("@")[0]}
            </div>
            <div className="relative mt-1 rounded-xl border border-[#e5daf4] bg-[#fffdfd] p-3 text-sm text-[#5b536d] shadow-sm">
              <div className="absolute -left-2 top-3 h-0 w-0 border-b-[6px] border-b-transparent border-r-[8px] border-r-[#fffdfd] border-t-[6px] border-t-transparent" />
              <TypingText text={localSkill.recommendation} />
            </div>
          </div>
        </div>
      )}

      {/* Install command */}
      <SkillInstallCommand
        skillName={localSkill.name}
        installCommand={localSkill.install_command}
        copied={localSkill.user_copied}
        onCopied={refreshSkill}
      />

      {/* Summary */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div>
          <span className="text-[#7d7391]">Category: </span>
          <span className="font-medium text-[#201730]">
            {categoryLabel}
          </span>
        </div>
        <div>
          <span className="text-[#7d7391]">Version: </span>
          <span className="font-medium text-[#201730]">
            v{localSkill.version}
          </span>
        </div>
      </div>

      {/* Markdown Content */}
      {localSkill.content && (
        <div className="border-t border-[#ddd2ee] pt-6">
          <h2 className="mb-4 text-lg font-semibold text-[#201730]">
            Skill Content
          </h2>
          <div className="rounded-3xl border border-[#ddd2ee] bg-[linear-gradient(180deg,#fffdfd_0%,#f7f2fd_100%)] px-6 py-6 shadow-[0_18px_48px_rgba(76,44,128,0.12)]">
            <SkillMarkdown content={localSkill.content} />
          </div>
        </div>
      )}

      {/* File Browser */}
      {files.length > 0 && (
        <div className="border-t border-[#ddd2ee] pt-6">
          <SkillFileBrowser slug={localSkill.name} files={files} />
        </div>
      )}

      {/* Version History */}
      {localSkill.versions.length > 0 && (
        <div className="border-t border-[#ddd2ee] pt-6">
          <SkillVersionHistory versions={localSkill.versions} />
        </div>
      )}

      <SkillComments slug={localSkill.name} />
        </div>
      </div>

      {headings.length > 0 && (
        <aside className="hidden xl:block">
          <div className="sticky top-24 overflow-hidden rounded-xl border border-[#bca8de] bg-[linear-gradient(180deg,#f3ecfb_0%,#ede4f8_100%)] shadow-[0_20px_42px_rgba(26,14,48,0.22)]">
            <div className="border-b border-[#cfbee8] bg-[linear-gradient(180deg,#e9dcf8_0%,#e3d5f5_100%)] px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[#6f6286]">
                Table Of Contents
              </div>
              <div className="mt-1 text-xs text-[#8a7ea0]">
                Click to jump through this skill
              </div>
            </div>

            <div className="relative px-3 py-4">
              <div className="absolute bottom-4 left-6 top-4 w-px bg-[linear-gradient(180deg,#c8b4e2_0%,#ddcff0_100%)]" />
              <nav className="relative space-y-1">
                {headings.map((heading) => {
                  const isActive = activeHeadingId === heading.id;
                  const isSubheading = heading.level === 3;

                  return (
                    <a
                      key={heading.id}
                      href={`#${heading.id}`}
                      onClick={(event) => handleTocClick(event, heading.id)}
                      className={`group relative block transition-all ${
                        isSubheading ? "ml-6" : ""
                      }`}
                    >
                      <div
                        className={`relative flex items-start gap-3 border px-3 py-2.5 ${
                          isActive
                            ? "border-[#b79add] bg-white text-[#241b38] shadow-[0_8px_20px_rgba(77,49,124,0.12)]"
                          : "border-transparent bg-transparent text-[#5e536f] hover:border-[#d7c8eb] hover:bg-[#f8f3fd] hover:text-[#241b38]"
                        } ${isSubheading ? "rounded-md" : "rounded-lg"}`}
                      >
                        <span className="relative z-10 block text-sm leading-5">
                          {heading.text}
                        </span>

                        <span
                          className={`absolute left-[-11px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 border-2 ${
                            isActive
                              ? "border-[#8f73c3] bg-[#8f73c3]"
                              : "border-[#c8b4e2] bg-[#f3ecfb] group-hover:border-[#a98bd4]"
                          } ${isSubheading ? "rounded-sm" : "rounded-full"}`}
                        />

                        {isActive && (
                          <span className="absolute inset-y-2 left-0 w-1 bg-[#8f73c3]" />
                        )}
                      </div>
                    </a>
                  );
                })}
              </nav>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
