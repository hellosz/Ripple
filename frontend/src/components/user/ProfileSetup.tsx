"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { users as usersApi } from "@/lib/api";
import { ZODIAC_OPTIONS, TAG_OPTIONS } from "@/lib/utils";
import type { ProfileCandidate } from "@/types";

interface ProfileSetupProps {
  onComplete: () => void;
}

export function ProfileSetup({ onComplete }: ProfileSetupProps) {
  const [gender, setGender] = useState<string>("secret");
  const [zodiac, setZodiac] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<ProfileCandidate[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const generateProfiles = async () => {
    setLoading(true);
    try {
      const res = await usersApi.generateProfile({
        gender,
        zodiac,
        tags: selectedTags,
      });
      setCandidates(res.candidates);
      setSelectedProfile(null);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (selectedProfile === null) return;
    setSaving(true);
    try {
      const profile = candidates[selectedProfile];
      await usersApi.updateProfile({
        gender,
        zodiac,
        tags: selectedTags,
        nickname: profile.nickname,
        description: profile.description,
      });
      onComplete();
    } catch {
      // Ignore
    } finally {
      setSaving(false);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : [...prev, tag]
    );
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Set Up Your Profile
      </h3>

      {/* Gender */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Gender
        </label>
        <div className="flex gap-3">
          {[
            { value: "male", label: "Male" },
            { value: "female", label: "Female" },
            { value: "secret", label: "Secret" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setGender(opt.value)}
              className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                gender === opt.value
                  ? "border-ripple-500 bg-ripple-50 dark:bg-ripple-950 text-ripple-600"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Zodiac */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Zodiac Sign
        </label>
        <div className="flex flex-wrap gap-2">
          {ZODIAC_OPTIONS.map((z) => (
            <button
              key={z}
              onClick={() => setZodiac(z)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                zodiac === z
                  ? "border-ripple-500 bg-ripple-50 dark:bg-ripple-950 text-ripple-600"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
              }`}
            >
              {z}
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Interest Tags
        </label>
        <div className="flex flex-wrap gap-2">
          {TAG_OPTIONS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                selectedTags.includes(tag)
                  ? "border-ripple-500 bg-ripple-50 dark:bg-ripple-950 text-ripple-600"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={generateProfiles}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ripple-500 text-white text-sm hover:bg-ripple-600 disabled:opacity-50 transition-colors"
      >
        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        {candidates.length ? "Regenerate" : "Generate"} Nickname & Description
      </button>

      {/* Candidates */}
      {candidates.length > 0 && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Choose your profile
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {candidates.map((c, i) => (
              <button
                key={i}
                onClick={() => setSelectedProfile(i)}
                className={`text-left p-3 rounded-lg border transition-colors ${
                  selectedProfile === i
                    ? "border-ripple-500 bg-ripple-50 dark:bg-ripple-950"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                }`}
              >
                <div className="font-medium text-sm text-gray-900 dark:text-white">
                  {c.nickname}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {c.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedProfile !== null && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 rounded-lg bg-ripple-500 text-white font-medium hover:bg-ripple-600 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save Profile"}
        </button>
      )}
    </div>
  );
}
