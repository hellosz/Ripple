import { getToken } from "./auth";
import type { Notification } from "@/types";

type NotificationHandler = (notification: Notification) => void;

let eventSource: EventSource | null = null;
let handlers: NotificationHandler[] = [];

export function connectSSE() {
  const token = getToken();
  if (!token || eventSource) return;

  eventSource = new EventSource(`/api/sse/notifications?token=${token}`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as Notification;
      handlers.forEach((handler) => handler(data));
    } catch {
      // Ignore parse errors (heartbeats, etc.)
    }
  };

  eventSource.onerror = () => {
    disconnectSSE();
    // Reconnect after 5 seconds
    setTimeout(connectSSE, 5000);
  };
}

export function disconnectSSE() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

export function onNotification(handler: NotificationHandler): () => void {
  handlers.push(handler);
  return () => {
    handlers = handlers.filter((h) => h !== handler);
  };
}
