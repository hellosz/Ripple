"use client";

import "./globals.css";
import { AnimatePresence } from "framer-motion";
import { AuthContext } from "@/lib/auth";
import { useAuthProvider } from "@/hooks/useAuth";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { LoginModal } from "@/components/user/LoginModal";
import { RippleNotification } from "@/components/interaction/RippleNotification";
import { RippleRevealModal } from "@/components/interaction/RippleRevealModal";
import { useSSE } from "@/hooks/useSSE";
import { useState } from "react";
import type { RippleNotification as RippleNotificationType } from "@/types";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authState = useAuthProvider();
  const { notifications, dismiss } = useSSE();
  const [activeRipple, setActiveRipple] = useState<RippleNotificationType | null>(null);

  return (
    <html lang="zh-CN">
      <head>
        <title>Ripple - AI Skill 分享平台</title>
        <meta name="description" content="发现、预览、下载和传播高质量的 AI Agent 技能包" />
      </head>
      <body className="min-h-screen">
        <AuthContext.Provider
          value={{
            user: authState.user,
            loading: authState.loading,
            login: authState.login,
            logout: authState.logout,
            refreshUser: authState.refreshUser,
            requireAuth: authState.requireAuth,
          }}
        >
          <Header />
          <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
          <Footer />

          <AnimatePresence>
            {authState.showLogin && (
              <LoginModal
                onClose={() => authState.setShowLogin(false)}
                onSuccess={authState.login}
              />
            )}
          </AnimatePresence>

          {/* Ripple Notifications */}
          <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3">
            {notifications.map((notification, index) => (
              <RippleNotification
                key={index}
                notification={notification}
                onDismiss={() => dismiss(index)}
                onOpenRipple={(incoming) => {
                  if (incoming.type === "ripple") {
                    setActiveRipple(incoming);
                  }
                }}
              />
            ))}
          </div>

          <AnimatePresence>
            {activeRipple && (
              <RippleRevealModal
                notification={activeRipple}
                onClose={() => setActiveRipple(null)}
              />
            )}
          </AnimatePresence>
        </AuthContext.Provider>
      </body>
    </html>
  );
}
