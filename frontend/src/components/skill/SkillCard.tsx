"use client";

import Link from "next/link";
import type { SkillListItem } from "@/types";

interface SkillCardProps {
  skill: SkillListItem;
}

export function SkillCard({ skill }: SkillCardProps) {
  return (
    <Link
      href={`/skill/${skill.name}`}
      className="group block rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 transition-all hover:border-white/[0.12] hover:bg-white/[0.05] card-fade-in"
    >
      <div className="flex items-start gap-3.5">
        {/* Terminal icon */}
        <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-mono text-white/30">
            {">_"}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm text-white/90 group-hover:text-ripple-400 transition-colors truncate">
            {skill.display_name || skill.name}
          </h3>
          {skill.description && (
            <p className="mt-1.5 text-sm text-white/35 line-clamp-3 leading-relaxed">
              {skill.description}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
