"use client";

import { useState } from "react";
import { Waves } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { interactions } from "@/lib/api";
import { useIconSize, useSizeTierClass } from "@/hooks/useSkillStats";
import type { SizeTier } from "@/types";

interface RippleButtonProps {
  slug: string;
  rippled: boolean;
  downloaded: boolean;
  sizeTier: SizeTier;
  onUpdate?: () => void;
}

export function RippleButton({
  slug,
  rippled,
  downloaded,
  sizeTier,
  onUpdate,
}: RippleButtonProps) {
  const { requireAuth } = useAuth();
  const [isRippled, setIsRippled] = useState(rippled);
  const [loading, setLoading] = useState(false);
  const iconSize = useIconSize(sizeTier);
  const tierClass = useSizeTierClass(sizeTier);

  const handleClick = () => {
    if (!downloaded) return;
    if (isRippled) return;

    requireAuth(async () => {
      if (loading) return;
      setLoading(true);
      try {
        await interactions.ripple(slug);
        setIsRippled(true);
        onUpdate?.();
      } catch {
        // Ignore errors
      } finally {
        setLoading(false);
      }
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading || !downloaded || isRippled}
      className={`flex items-center gap-1 p-1.5 rounded-lg transition-all ${
        !downloaded
          ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
          : isRippled
          ? "text-ripple-500"
          : `${tierClass} hover:bg-gray-100 dark:hover:bg-gray-800`
      }`}
      title={
        !downloaded
          ? "Download first to RP"
          : isRippled
          ? "Already Rippled"
          : "Ripple Push"
      }
    >
      <Waves size={iconSize} className="transition-all" />
    </button>
  );
}
