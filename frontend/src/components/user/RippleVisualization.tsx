"use client";

import { UserAvatar } from "./UserAvatar";
import type { RippleRecord } from "@/types";

interface RippleVisualizationProps {
  ripple: RippleRecord;
}

export function RippleVisualization({ ripple }: RippleVisualizationProps) {
  const pushes = ripple.pushes;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="text-sm font-medium text-gray-900 dark:text-white mb-4">
        {ripple.skill_display_name}
      </div>

      <div className="relative w-64 h-64 mx-auto">
        {/* Ripple rings */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="absolute w-full h-full rounded-full border border-ripple-200 dark:border-ripple-800 ripple-ring" />
          <div className="absolute w-3/4 h-3/4 rounded-full border border-ripple-300 dark:border-ripple-700 ripple-ring" />
          <div className="absolute w-1/2 h-1/2 rounded-full border border-ripple-400 dark:border-ripple-600 ripple-ring" />
        </div>

        {/* Center - Skill icon */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-ripple-500 flex items-center justify-center text-white text-lg z-10">
          R
        </div>

        {/* User avatars distributed on the ring */}
        {pushes.map((push, i) => {
          const angle = (i / pushes.length) * 2 * Math.PI - Math.PI / 2;
          const radius = 90 + Math.random() * 20;
          const x = Math.cos(angle) * radius + 128;
          const y = Math.sin(angle) * radius + 128;
          const avatarSize = 24 + Math.random() * 16;
          const isViewed = push.status === "consumed";

          return (
            <div
              key={push.id}
              className="absolute z-20 transition-all"
              style={{
                left: x - avatarSize / 2,
                top: y - avatarSize / 2,
                opacity: isViewed ? 1 : 0.4,
              }}
              title={`${push.target_user.nickname || push.target_user.email.split("@")[0]} - ${push.status}`}
            >
              <UserAvatar user={push.target_user} size={avatarSize} />
            </div>
          );
        })}
      </div>

      <div className="flex justify-center gap-4 mt-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-400" /> Consumed
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-300 opacity-40" /> Pending
        </span>
      </div>
    </div>
  );
}
