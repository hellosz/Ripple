"use client";

import { useState, useEffect, useCallback } from "react";
import { onNotification } from "@/lib/sse";
import type { Notification } from "@/types";

export function useSSE() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const unsubscribe = onNotification((notification) => {
      setNotifications((prev) => [notification, ...prev]);

      // Auto-remove after 10 seconds
      setTimeout(() => {
        setNotifications((prev) =>
          prev.filter((n) => n !== notification)
        );
      }, 10000);
    });

    return unsubscribe;
  }, []);

  const dismiss = useCallback((index: number) => {
    setNotifications((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return { notifications, dismiss };
}
