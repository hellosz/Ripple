"use client";

import { SkillCardGrid } from "@/components/skill/SkillCardGrid";
import { SearchBar } from "@/components/layout/SearchBar";
import { RippleQuote } from "@/components/layout/RippleQuote";
import { useState } from "react";

export default function HomePage() {
  const [search, setSearch] = useState("");

  return (
    <div>
      {/* Hero — title + search zone */}
      <div className="text-center pt-10 pb-8 md:pt-14 md:pb-10">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white">
          One Drop, Endless{" "}
          <span className="text-ripple-400">Ripples.</span>
        </h1>
        <RippleQuote />

        {/* Search bar */}
        <div className="mt-8 w-3/5 min-w-[280px] mx-auto">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search skills..."
            expandable
          />
        </div>
      </div>

      {/* Feed list — visually separated */}
      <SkillCardGrid search={search} />
    </div>
  );
}
