"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Terminal } from "lucide-react";
import { interactions } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface SkillInstallCommandProps {
  skillName: string;
  installCommand: string;
  copied?: boolean;
  onCopied?: () => void;
}

export function SkillInstallCommand({
  skillName,
  installCommand,
  copied = false,
  onCopied,
}: SkillInstallCommandProps) {
  const { requireAuth } = useAuth();
  const [justCopied, setJustCopied] = useState(false);
  const [persistedCopied, setPersistedCopied] = useState(copied);

  useEffect(() => {
    setPersistedCopied(copied);
  }, [copied]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(installCommand);
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 2000);

    requireAuth(async () => {
      try {
        await interactions.copy(skillName);
        setPersistedCopied(true);
        onCopied?.();
      } catch {
        // Ignore interaction persistence failures after clipboard success.
      }
    });
  };

  return (
    <div className="rounded-2xl border border-[#d8caef] bg-[#2c2340] p-4 shadow-[0_16px_40px_rgba(49,29,78,0.2)]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2 text-[#cdbff0]">
          <Terminal size={14} className="flex-shrink-0" />
          <code className="truncate text-sm text-[#86f0c8]">$ {installCommand}</code>
        </div>
        <button
          onClick={handleCopy}
          className="flex-shrink-0 rounded-md p-2 text-[#d9cff4] transition-colors hover:bg-white/10 hover:text-white"
          title="Copy command"
        >
          {justCopied || persistedCopied ? <Check size={16} className="text-[#86f0c8]" /> : <Copy size={16} />}
        </button>
      </div>
    </div>
  );
}
