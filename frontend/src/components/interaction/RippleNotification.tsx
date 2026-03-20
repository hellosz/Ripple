"use client";

import { motion } from "framer-motion";
import { X, Waves, ArrowUpCircle } from "lucide-react";
import Link from "next/link";
import type { Notification } from "@/types";

interface RippleNotificationProps {
  notification: Notification;
  onDismiss: () => void;
  onOpenRipple?: (notification: Notification) => void;
}

export function RippleNotification({
  notification,
  onDismiss,
  onOpenRipple,
}: RippleNotificationProps) {
  const isRipple = notification.type === "ripple";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="relative bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 w-80 animate-fade-in"
    >
      {/* Ripple wave background effect */}
      <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
        <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-ripple-100 dark:bg-ripple-900/30 ripple-ring" />
      </div>

      <div className="relative">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-ripple-100 dark:bg-ripple-900 flex items-center justify-center">
            {isRipple ? (
              <Waves size={16} className="text-ripple-500" />
            ) : (
              <ArrowUpCircle size={16} className="text-ripple-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            {isRipple ? (
              <>
                <p className="text-sm text-gray-900 dark:text-white">
                  <strong>
                    {notification.sender.nickname ||
                      notification.sender.email.split("@")[0]}
                  </strong>{" "}
                  recommended
                </p>
                <p className="text-sm font-medium text-ripple-600 dark:text-ripple-400 truncate">
                  {notification.skill_name}
                </p>
                {notification.comment && (
                  <p className="text-xs text-gray-500 mt-1 italic">
                    &quot;{notification.comment}&quot;
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-gray-900 dark:text-white">
                  <strong>{notification.skill_name}</strong> updated
                </p>
                <p className="text-xs text-gray-500">
                  v{notification.new_version}
                </p>
              </>
            )}
          </div>
          <button
            onClick={onDismiss}
            className="flex-shrink-0 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X size={14} className="text-gray-400" />
          </button>
        </div>

        <div className="flex gap-2 mt-3">
          {isRipple ? (
            <button
              onClick={() => {
                onOpenRipple?.(notification);
                onDismiss();
              }}
              className="flex-1 text-center text-sm py-1.5 rounded-lg bg-ripple-50 dark:bg-ripple-950 text-ripple-600 dark:text-ripple-400 hover:bg-ripple-100 dark:hover:bg-ripple-900 transition-colors"
            >
              Open Ripple
            </button>
          ) : (
            <Link
              href={`/skill/${notification.skill_slug}`}
              className="flex-1 text-center text-sm py-1.5 rounded-lg bg-ripple-50 dark:bg-ripple-950 text-ripple-600 dark:text-ripple-400 hover:bg-ripple-100 dark:hover:bg-ripple-900 transition-colors"
              onClick={onDismiss}
            >
              View
            </Link>
          )}
          <button
            onClick={onDismiss}
            className="flex-1 text-center text-sm py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </motion.div>
  );
}
