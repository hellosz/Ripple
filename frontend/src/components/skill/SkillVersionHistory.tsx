"use client";

import type { SkillVersion } from "@/types";
import { formatDate } from "@/lib/utils";
import { SkillRating } from "./SkillRating";

interface SkillVersionHistoryProps {
  versions: SkillVersion[];
}

export function SkillVersionHistory({ versions }: SkillVersionHistoryProps) {
  if (!versions.length) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Version History
      </h3>
      <div className="space-y-0">
        {versions.map((v, i) => (
          <div
            key={v.id}
            className="flex items-start gap-3 py-3 border-l-2 border-gray-200 dark:border-gray-700 pl-4 relative"
          >
            <div className="absolute -left-[5px] top-4 w-2 h-2 rounded-full bg-ripple-500" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                  v{v.version}
                </span>
                {v.rating && <SkillRating rating={v.rating} size="sm" />}
                <span className="text-xs text-gray-500">
                  {formatDate(v.created_at)}
                </span>
              </div>
              {v.changelog && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {v.changelog}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
