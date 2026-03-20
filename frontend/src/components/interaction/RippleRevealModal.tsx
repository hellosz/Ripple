"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Gift, Waves, X } from "lucide-react";

import { ripples as rippleApi, skills as skillsApi } from "@/lib/api";
import { SkillMarkdown } from "@/components/skill/SkillMarkdown";
import type { RippleNotification, SkillDetail } from "@/types";

interface RippleRevealModalProps {
  notification: RippleNotification;
  onClose: () => void;
}

export function RippleRevealModal({
  notification,
  onClose,
}: RippleRevealModalProps) {
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const senderName = useMemo(
    () =>
      notification.sender.nickname ||
      notification.sender.email.split("@")[0] ||
      "Someone",
    [notification.sender]
  );

  useEffect(() => {
    const revealTimer = window.setTimeout(() => setShowModal(true), 950);
    rippleApi.consumeDelivery(notification.delivery_id).catch(() => {});
    skillsApi
      .get(notification.skill_slug)
      .then(setDetail)
      .finally(() => setLoading(false));

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(revealTimer);
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [notification.delivery_id, notification.skill_slug, onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(112,181,255,0.18)_0%,rgba(15,23,42,0.9)_52%,rgba(2,6,23,0.96)_100%)] backdrop-blur-md"
        onClick={onClose}
      />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {[0, 1, 2].map((index) => (
          <motion.div
            key={index}
            className="absolute rounded-full border border-[#9dd6ff]/40 bg-[#9dd6ff]/10"
            initial={{ width: 84, height: 84, opacity: 0.8, scale: 0.6 }}
            animate={{
              width: 420 + index * 110,
              height: 420 + index * 110,
              opacity: 0,
              scale: 1.25,
            }}
            transition={{
              duration: 1.25,
              delay: index * 0.16,
              ease: [0.16, 1, 0.3, 1],
            }}
          />
        ))}

        <motion.div
          initial={{ scale: 0.7, opacity: 0, y: 18 }}
          animate={{ scale: showModal ? 0.8 : 1, opacity: showModal ? 0 : 1, y: showModal ? -20 : 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex h-28 w-28 items-center justify-center rounded-[32px] border border-[#c8ecff]/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(202,238,255,0.92)_100%)] text-[#0f5e88] shadow-[0_30px_90px_rgba(56,189,248,0.28)]"
        >
          <div className="relative">
            <Waves className="absolute -left-5 top-5 text-[#67c5ff]/70" size={18} />
            <Gift size={36} />
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-[81] flex max-h-[84vh] w-full max-w-3xl flex-col overflow-hidden rounded-[32px] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(239,249,255,0.96)_100%)] text-[#102437] shadow-[0_40px_120px_rgba(8,47,73,0.35)]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#d2ebfb] px-6 py-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#5f91b0]">
                  Ripple Reveal
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#102437]">
                  {senderName} sent you a Ripple
                </h2>
                <p className="mt-1 text-sm text-[#4b6780]">
                  {notification.skill_display_name}
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-2 text-[#7ea0b7] transition hover:bg-white hover:text-[#102437]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {notification.comment && (
                <div className="mb-5 rounded-2xl border border-[#cde8fa] bg-[#f5fbff] px-4 py-3 text-sm text-[#33536c]">
                  “{notification.comment}”
                </div>
              )}

              {loading ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-5 w-1/3 rounded bg-[#ddeef9]" />
                  <div className="h-4 w-full rounded bg-[#eef7fd]" />
                  <div className="h-4 w-5/6 rounded bg-[#eef7fd]" />
                  <div className="h-40 rounded-3xl bg-[#f5fbff]" />
                </div>
              ) : detail?.content ? (
                <div className="rounded-[28px] border border-[#d6edf9] bg-white/85 px-5 py-5 shadow-[inset_0_1px_2px_rgba(16,36,55,0.04)]">
                  <SkillMarkdown content={detail.content} />
                </div>
              ) : (
                <div className="rounded-[28px] border border-dashed border-[#d6edf9] bg-white/80 px-5 py-8 text-center text-sm text-[#5d768b]">
                  Skill preview is unavailable, but the full detail page is ready.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[#d2ebfb] px-6 py-4">
              <div className="text-sm text-[#5d768b]">
                Open the full detail page to continue the thread or install the skill.
              </div>
              <Link
                href={`/skill/${notification.skill_slug}`}
                onClick={onClose}
                className="rounded-2xl bg-[linear-gradient(90deg,#0f9fd8_0%,#38bdf8_100%)] px-4 py-2.5 text-sm font-medium text-white shadow-[0_16px_32px_rgba(14,165,233,0.28)] transition hover:translate-y-[-1px]"
              >
                Open Skill
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
}
