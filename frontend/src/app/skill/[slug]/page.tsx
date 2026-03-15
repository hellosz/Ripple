"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { skills as skillsApi } from "@/lib/api";
import { SkillDetailComponent } from "@/components/skill/SkillDetail";
import type { SkillDetail } from "@/types";

export default function SkillDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [skill, setSkill] = useState<SkillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    skillsApi
      .get(slug)
      .then(setSkill)
      .catch((err) => setError(err.message || "Failed to load skill"))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded" />
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

  return <SkillDetailComponent skill={skill} />;
}
