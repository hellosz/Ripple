"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { skills as skillsApi } from "@/lib/api";
import { SkillDetailComponent } from "@/components/skill/SkillDetail";
import type { SkillDetail } from "@/types";

export default function SkillDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [skill, setSkill] = useState<SkillDetail | null>(() =>
    slug ? skillsApi.peek(slug) : null
  );
  const [loading, setLoading] = useState(() => (slug ? !skillsApi.peek(slug) : true));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    const cached = skillsApi.peek(slug);
    if (cached) {
      setSkill(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    skillsApi
      .get(slug)
      .then(setSkill)
      .catch((err) => setError(err.message || "Failed to load skill"))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="mx-auto grid w-full max-w-[1440px] gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="animate-pulse rounded-[32px] border border-[#d9c9f1]/50 bg-[linear-gradient(180deg,rgba(250,246,255,0.94)_0%,rgba(244,239,251,0.96)_100%)] p-6 shadow-[0_28px_100px_rgba(10,6,20,0.16)] md:p-8">
          <div className="h-5 w-24 rounded bg-[#e7def3]" />
          <div className="mt-8 h-8 w-72 rounded bg-[#ddd2ee]" />
          <div className="mt-4 flex gap-2">
            <div className="h-6 w-14 rounded-full bg-[#eee6f8]" />
            <div className="h-6 w-20 rounded-full bg-[#eee6f8]" />
            <div className="h-6 w-16 rounded-full bg-[#eee6f8]" />
          </div>
          <div className="mt-5 h-5 w-3/4 rounded bg-[#e7def3]" />
          <div className="mt-8 h-14 rounded-2xl bg-[#312844]" />
          <div className="mt-8 border-t border-[#ddd2ee] pt-8">
            <div className="h-6 w-36 rounded bg-[#ddd2ee]" />
            <div className="mt-6 h-5 w-1/2 rounded bg-[#e7def3]" />
            <div className="mt-4 h-4 w-full rounded bg-[#eee6f8]" />
            <div className="mt-2 h-4 w-[94%] rounded bg-[#eee6f8]" />
            <div className="mt-2 h-4 w-[88%] rounded bg-[#eee6f8]" />
            <div className="mt-8 h-40 rounded-3xl bg-[#f6f1fc]" />
          </div>
        </div>
        <div className="hidden animate-pulse xl:block">
          <div className="rounded-xl border border-[#bca8de]/50 bg-[linear-gradient(180deg,#f3ecfb_0%,#ede4f8_100%)] p-4">
            <div className="h-3 w-28 rounded bg-[#d8caee]" />
            <div className="mt-6 space-y-3">
              <div className="h-4 w-32 rounded bg-[#e6dcf5]" />
              <div className="h-4 w-40 rounded bg-[#e6dcf5]" />
              <div className="h-4 w-28 rounded bg-[#e6dcf5]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-lg text-gray-500">{error}</p>
      </div>
    );
  }

  if (!skill) {
    return (
      <div className="text-center py-12">
        <p className="text-lg text-gray-500">Skill not found</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto w-full max-w-[1440px]"
    >
      <SkillDetailComponent skill={skill} />
    </motion.div>
  );
}
