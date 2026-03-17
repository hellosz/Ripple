"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { interactions } from "@/lib/api";
import { useIconSize, useSizeTierClass } from "@/hooks/useSkillStats";
import type { SizeTier } from "@/types";

interface LikeButtonProps {
  slug: string;
  liked: boolean;
  sizeTier: SizeTier;
  onUpdate?: () => void;
}

export function LikeButton({ slug, liked, sizeTier, onUpdate }: LikeButtonProps) {
  const { requireAuth } = useAuth();
  const [isLiked, setIsLiked] = useState(liked);
  const [loading, setLoading] = useState(false);
  const iconSize = useIconSize(sizeTier);
  const tierClass = useSizeTierClass(sizeTier);

  useEffect(() => {
    setIsLiked(liked);
  }, [liked]);

  const handleClick = () => {
    requireAuth(async () => {
      if (loading) return;
      setLoading(true);
      try {
        if (isLiked) {
          await interactions.unlike(slug);
          setIsLiked(false);
        } else {
          await interactions.like(slug);
          setIsLiked(true);
        }
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
      disabled={loading}
      className={`flex items-center gap-1 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all ${
        isLiked ? "text-red-500" : tierClass
      }`}
      title={isLiked ? "Unlike" : "Like"}
    >
      <Heart
        size={iconSize}
        fill={isLiked ? "currentColor" : "none"}
        className="transition-all"
      />
    </button>
  );
}
