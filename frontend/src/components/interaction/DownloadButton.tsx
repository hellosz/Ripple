"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useIconSize, useSizeTierClass } from "@/hooks/useSkillStats";
import type { SizeTier } from "@/types";

interface DownloadButtonProps {
  slug: string;
  downloaded: boolean;
  sizeTier: SizeTier;
  onUpdate?: () => void;
}

export function DownloadButton({
  slug,
  downloaded,
  sizeTier,
  onUpdate,
}: DownloadButtonProps) {
  const { requireAuth } = useAuth();
  const [isDownloaded, setIsDownloaded] = useState(downloaded);
  const [loading, setLoading] = useState(false);
  const iconSize = useIconSize(sizeTier);
  const tierClass = useSizeTierClass(sizeTier);

  const handleClick = () => {
    requireAuth(async () => {
      if (loading) return;
      setLoading(true);
      try {
        // Trigger download via direct link
        const token = localStorage.getItem("ripple_token");
        const res = await fetch(`/api/skills/${slug}/download`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${slug}.zip`;
          a.click();
          URL.revokeObjectURL(url);
          setIsDownloaded(true);
          onUpdate?.();
        }
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
        isDownloaded ? "text-ripple-500" : tierClass
      }`}
      title="Download"
    >
      <Download
        size={iconSize}
        className={`transition-all ${loading ? "animate-bounce" : ""}`}
      />
    </button>
  );
}
