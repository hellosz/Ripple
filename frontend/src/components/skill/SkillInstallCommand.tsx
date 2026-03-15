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
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-900 dark:bg-gray-950 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-gray-400 min-w-0">
          <Terminal size={14} className="flex-shrink-0" />
          <code className="text-sm text-green-400 truncate">$ {command}</code>
        </div>
        <button
          onClick={handleCopy}
          className="flex-shrink-0 p-2 rounded-md hover:bg-gray-800 transition-colors text-gray-400 hover:text-white"
          title="Copy command"
        >
          {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
        </button>
      </div>
    </div>
  );
}
