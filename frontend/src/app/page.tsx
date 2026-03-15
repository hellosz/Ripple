"use client";

import { SkillCardGrid } from "@/components/skill/SkillCardGrid";
import { RippleQuote } from "@/components/layout/RippleQuote";

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <div className="text-center pt-16 pb-8 md:pt-24 md:pb-12">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white">
          One Drop, Endless{" "}
          <span className="text-white/30">Ripples.</span>
        </h1>
        <RippleQuote />
      </div>

      {/* Skill Card Grid */}
      <SkillCardGrid />
    </div>
  );
}
