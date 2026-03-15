"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, BookOpen } from "lucide-react";

interface KnowledgeCardProps {
  collapsible?: boolean;
}

export function KnowledgeCard({ collapsible = true }: KnowledgeCardProps) {
  const [expanded, setExpanded] = useState(!collapsible);

  return (
    <div className="rounded-xl border border-ripple-200 dark:border-ripple-800 bg-ripple-50/50 dark:bg-ripple-950/30">
      <button
        onClick={() => collapsible && setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4"
      >
        <div className="flex items-center gap-2">
          <BookOpen size={18} className="text-ripple-500" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            New to AI Skills? Learn the basics
          </span>
        </div>
        {collapsible && (
          expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 text-sm text-gray-600 dark:text-gray-400 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
              <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                What is a Skill?
              </h4>
              <p className="text-xs">
                A reusable AI Agent skill package with prompts, workflows, and configurations that can be shared.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
              <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                How to Install
              </h4>
              <p className="text-xs">
                Use the one-line install command on any skill page to add it to your environment instantly.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
              <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                Share & Spread
              </h4>
              <p className="text-xs">
                Use RP (Ripple Push) to recommend great skills to others, spreading quality content organically.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
