"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import type { SkillListItem as SkillListItemType } from "@/types";
import { skills as skillsApi } from "@/lib/api";
import { SkillRating } from "./SkillRating";
import { LikeButton } from "@/components/interaction/LikeButton";
import { DownloadButton } from "@/components/interaction/DownloadButton";
import { RippleButton } from "@/components/interaction/RippleButton";
import { ORIGIN_LABELS, CATEGORY_LABELS } from "@/lib/utils";
import { navigateWithTransition } from "@/lib/navigation";

interface SkillListItemProps {
  skill: SkillListItemType;
  onTagClick?: (tag: string) => void;
}

export function SkillListItemComponent({
  skill,
  onTagClick,
}: SkillListItemProps) {
  const router = useRouter();
  const href = `/skill/${skill.name}`;
  const categoryLabel =
    CATEGORY_LABELS[skill.category || ""] || skill.category || "";

  const handleNavigate = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }
    e.preventDefault();
    navigateWithTransition(router, href);
  };

  const handlePrefetch = () => {
    void skillsApi.prefetch(skill.name);
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors animate-fade-in">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-medium text-gray-500 dark:text-gray-400">
          {categoryLabel.slice(0, 2)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={href}
              onClick={handleNavigate}
              onMouseEnter={handlePrefetch}
              onFocus={handlePrefetch}
              className="font-semibold text-gray-900 dark:text-white hover:text-ripple-600 dark:hover:text-ripple-400 transition-colors"
            >
              {skill.display_name}
            </Link>

            {skill.tags?.map((tag) => (
              <button
                key={tag}
                onClick={() => onTagClick?.(tag)}
                className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
            {skill.description}
          </p>

          {/* Actions bar */}
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <RippleButton
              slug={skill.name}
              rippled={skill.user_rippled}
              copied={skill.user_copied}
              liked={skill.user_liked}
              available={skill.ripple_available}
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

            <div className="ml-auto flex items-center gap-2">
              <SkillRating rating={skill.rating} />
              <span className="text-xs text-gray-400">
                {ORIGIN_LABELS[skill.origin_type]}
              </span>
              <Link
                href={href}
                onClick={handleNavigate}
                onMouseEnter={handlePrefetch}
                onFocus={handlePrefetch}
                className="flex items-center gap-0.5 text-xs text-ripple-600 dark:text-ripple-400 hover:underline"
              >
                View <ChevronRight size={12} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
