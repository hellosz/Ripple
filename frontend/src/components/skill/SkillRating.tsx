"use client";

import type { Rating } from "@/types";
import { RATING_CONFIG } from "@/lib/utils";

interface SkillRatingProps {
  rating: Rating;
  size?: "sm" | "md";
}

export function SkillRating({ rating, size = "sm" }: SkillRatingProps) {
  const config = RATING_CONFIG[rating];
  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${config.bgColor} ${config.color} ${sizeClasses}`}
    >
      <span>{config.emoji}</span>
      <span>{config.label}</span>
    </span>
  );
}
