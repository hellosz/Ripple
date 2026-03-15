"use client";

import { SkillCardGrid } from "@/components/skill/SkillCardGrid";

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <div className="text-center pt-16 pb-8 md:pt-24 md:pb-12">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white">
          Supercharge your{" "}
          <span className="text-white/30">Agents.</span>
        </h1>
        <p className="mt-4 text-white/40 max-w-2xl mx-auto text-base md:text-lg">
          A curated collection of specialized skills to make your AI agents
          smarter, faster, and more capable.
        </p>
      </div>

      {/* Skill Card Grid */}
      <SkillCardGrid />
    </div>
  );
}
