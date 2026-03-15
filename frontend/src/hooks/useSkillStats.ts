"use client";

import type { SizeTier } from "@/types";
import { SIZE_TIER_PX } from "@/lib/utils";

export function useIconSize(tier: SizeTier): number {
  return SIZE_TIER_PX[tier] || 16;
}

export function useSizeTierClass(tier: SizeTier): string {
  const classes: Record<SizeTier, string> = {
    default: "text-gray-400",
    small: "text-gray-500",
    medium: "text-gray-600",
    large: "text-gray-700 drop-shadow-sm",
    xlarge: "text-gray-800 drop-shadow-md animate-breathe",
  };
  return classes[tier] || classes.default;
}
