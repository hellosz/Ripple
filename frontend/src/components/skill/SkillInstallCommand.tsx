"use client";

import { useState } from "react";
import { Copy, Check, Terminal } from "lucide-react";

interface SkillInstallCommandProps {
  skillName: string;
}

export function SkillInstallCommand({ skillName }: SkillInstallCommandProps) {
  const [copied, setCopied] = useState(false);
  const command = `npx skills add https://github.com/org/ripple --skill ${skillName}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-[#d8caef] bg-[#2c2340] p-4 shadow-[0_16px_40px_rgba(49,29,78,0.2)]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2 text-[#cdbff0]">
          <Terminal size={14} className="flex-shrink-0" />
          <code className="truncate text-sm text-[#86f0c8]">$ {command}</code>
        </div>
        <button
          onClick={handleCopy}
          className="flex-shrink-0 rounded-md p-2 text-[#d9cff4] transition-colors hover:bg-white/10 hover:text-white"
          title="Copy command"
        >
          {copied ? <Check size={16} className="text-[#86f0c8]" /> : <Copy size={16} />}
        </button>
      </div>
    </div>
  );
}
