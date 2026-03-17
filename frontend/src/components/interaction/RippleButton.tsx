"use client";

import { useEffect, useState } from "react";
import { Waves } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { interactions } from "@/lib/api";
import { useIconSize, useSizeTierClass } from "@/hooks/useSkillStats";
import type { SizeTier } from "@/types";

interface RippleButtonProps {
  slug: string;
  rippled: boolean;
  copied: boolean;
  liked: boolean;
  available: boolean;
  sizeTier: SizeTier;
  onUpdate?: () => void;
}

export function RippleButton({
  slug,
  rippled,
  copied,
  liked,
  available,
  sizeTier,
  onUpdate,
}: RippleButtonProps) {
  const { requireAuth } = useAuth();
  const [isRippled, setIsRippled] = useState(rippled);
  const [loading, setLoading] = useState(false);
  const iconSize = useIconSize(sizeTier);
  const tierClass = useSizeTierClass(sizeTier);

  useEffect(() => {
    setIsRippled(rippled);
  }, [rippled]);

  const handleClick = () => {
    if (!available) return;
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
      disabled={loading || !available || isRippled}
      className={`flex items-center gap-1 p-1.5 rounded-lg transition-all ${
        !available
          ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
          : isRippled
          ? "text-ripple-500"
          : `${tierClass} hover:bg-gray-100 dark:hover:bg-gray-800`
      }`}
      title={
        !available
          ? copied || liked
            ? "Copy and like are both required before Ripple"
            : "Copy and like before Ripple"
          : isRippled
          ? "Already Rippled"
          : "Ripple Push"
      }
    >
      <Waves size={iconSize} className="transition-all" />
    </button>
  );
}
