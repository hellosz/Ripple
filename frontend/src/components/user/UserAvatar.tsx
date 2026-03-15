"use client";

import type { UserBrief } from "@/types";

interface UserAvatarProps {
  user: UserBrief;
  size?: number;
}

export function UserAvatar({ user, size = 32 }: UserAvatarProps) {
  const initial = user.nickname?.[0] || user.email[0].toUpperCase();

  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.nickname || user.email}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  // Generate a deterministic color from user id
  const colors = [
    "bg-blue-400", "bg-green-400", "bg-purple-400", "bg-pink-400",
    "bg-yellow-400", "bg-red-400", "bg-indigo-400", "bg-teal-400",
  ];
  const colorIndex = user.id.charCodeAt(0) % colors.length;

  return (
    <div
      className={`${colors[colorIndex]} rounded-full flex items-center justify-center text-white font-medium`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </div>
  );
}
