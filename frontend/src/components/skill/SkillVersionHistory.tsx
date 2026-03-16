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
      <h3 className="text-lg font-semibold text-[#201730]">
        Version History
      </h3>
      <div className="space-y-0">
        {versions.map((v, i) => (
          <div
            key={v.id}
            className="relative flex items-start gap-3 border-l-2 border-[#ddd2ee] py-3 pl-4"
          >
            <div className="absolute -left-[5px] top-4 h-2 w-2 rounded-full bg-[#7c62b7]" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-medium text-[#201730]">
                  v{v.version}
                </span>
                {v.rating && <SkillRating rating={v.rating} size="sm" />}
                <span className="text-xs text-[#8b809f]">
                  {formatDate(v.created_at)}
                </span>
              </div>
              {v.changelog && (
                <p className="mt-1 text-sm text-[#5b536d]">
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
