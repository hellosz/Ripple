"use client";

import { useState } from "react";
import { Upload, X } from "lucide-react";
import { motion } from "framer-motion";
import { skills as skillsApi } from "@/lib/api";
import { SkillRating } from "./SkillRating";
import type { Rating } from "@/types";

interface SkillUploadFormProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export function SkillUploadForm({ onClose, onSuccess }: SkillUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("tools");
  const [recommendation, setRecommendation] = useState("");
  const [originType, setOriginType] = useState("original");
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    name: string;
    rating: Rating;
    suggestions: string[] | null;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);
      formData.append("recommendation", recommendation);
      formData.append("origin_type", originType);
      if (tags) formData.append("tags", tags);

      const res = await skillsApi.upload(formData);
      setResult(res);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.18),transparent_30%),rgba(10,6,18,0.68)] px-4 backdrop-blur-[6px]"
      initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
      animate={{ opacity: 1, backdropFilter: "blur(6px)" }}
      exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="w-full max-w-[560px] max-h-[90vh] overflow-y-auto rounded-[28px] border border-white/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,244,255,0.97)_100%)] shadow-[0_30px_90px_rgba(20,10,35,0.32)]"
        initial={{ opacity: 0, y: 24, scale: 0.96, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: 18, scale: 0.98, filter: "blur(8px)" }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="relative border-b border-[#e7dcf5] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(244,237,252,0.92)_100%)] px-8 py-6">
          <h2 className="text-center text-[30px] font-semibold tracking-[-0.03em] text-[#1d1630]">
            Upload Skill
          </h2>
          <div className="mt-3 flex justify-center">
            <div className="h-px w-24 bg-[linear-gradient(90deg,transparent_0%,#cdb8ea_50%,transparent_100%)]" />
          </div>
          <button
            onClick={onClose}
            className="absolute right-5 top-5 rounded-full p-2 text-[#c0b3d6] transition-all duration-200 hover:scale-105 hover:bg-[#f1e8fb] hover:text-[#6f5a96] active:scale-95 active:bg-[#eadcf8]"
          >
            <X size={18} />
          </button>
        </div>

        {result ? (
          <div className="space-y-5 px-8 py-8">
            <div className="text-center">
              <div className="mb-2 text-2xl font-semibold text-[#1d1630]">Upload Successful!</div>
              <p className="text-[#5a516f]">
                <strong>{result.name}</strong> has been published
              </p>
              <div className="mt-2">
                <SkillRating rating={result.rating} size="md" />
              </div>
            </div>
            {result.suggestions && result.suggestions.length > 0 && (
              <div className="rounded-2xl border border-[#f0deb0] bg-[linear-gradient(180deg,#fff7de_0%,#fff0c9_100%)] p-4 shadow-sm">
                <h4 className="mb-2 font-medium text-[#825d00]">
                  Improvement Suggestions
                </h4>
                <ul className="space-y-1 text-sm text-[#8d6a12]">
                  {result.suggestions.map((s, i) => (
                    <li key={i}>- {s}</li>
                  ))}
                </ul>
              </div>
            )}
            <button
              onClick={onClose}
              className="w-full rounded-2xl bg-[linear-gradient(90deg,#7c4de0_0%,#9a62f6_100%)] py-3.5 text-base font-medium text-white shadow-[0_16px_36px_rgba(124,77,224,0.34)] transition-all duration-200 hover:translate-y-[-1px] hover:scale-[1.01] hover:shadow-[0_20px_42px_rgba(124,77,224,0.42)] active:translate-y-[1px] active:scale-[0.992] active:shadow-[0_10px_24px_rgba(124,77,224,0.28)]"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 px-8 py-8">
            {/* File Upload */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[#554b6a]">
                Skill Package (ZIP)
              </label>
              <div className="rounded-2xl border border-dashed border-[#daccf0] bg-white/85 p-6 text-center shadow-[inset_0_1px_2px_rgba(25,12,44,0.04)]">
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-sm font-medium text-[#241b38]">
                      {file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="rounded-full p-1 text-[#b4a7ca] transition-colors hover:bg-[#f1e8fb] hover:text-[#6f5a96]"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload size={24} className="mx-auto mb-2 text-[#a194ba]" />
                    <p className="text-sm text-[#6c6281]">
                      Click to select .zip file (max 10MB)
                    </p>
                    <input
                      type="file"
                      accept=".zip"
                      className="hidden"
                      onChange={(e) =>
                        setFile(e.target.files?.[0] || null)
                      }
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[#554b6a]">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-2xl border border-[#dacdee] bg-white px-4 py-3 text-[15px] text-[#241b38] shadow-[inset_0_1px_2px_rgba(25,12,44,0.04)] outline-none transition-all focus:border-[#9a7ee0] focus:ring-4 focus:ring-[#8b5cf6]/12"
              >
                <option value="tools">Tools</option>
                <option value="workflow">Workflow</option>
                <option value="engineering">Engineering</option>
                <option value="automation">Automation</option>
                <option value="writing">Writing</option>
              </select>
            </div>

            {/* Recommendation */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[#554b6a]">
                Author Recommendation
              </label>
              <textarea
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value)}
                className="min-h-[104px] w-full rounded-2xl border border-[#dacdee] bg-white px-4 py-3 text-[15px] text-[#241b38] shadow-[inset_0_1px_2px_rgba(25,12,44,0.04)] outline-none transition-all placeholder:text-[#d2c6e3] focus:border-[#9a7ee0] focus:ring-4 focus:ring-[#8b5cf6]/12"
                rows={4}
                placeholder="Describe why this skill is great..."
                required
              />
            </div>

            {/* Origin Type */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[#554b6a]">
                Origin
              </label>
              <div className="flex flex-wrap gap-4">
                {[
                  { value: "original", label: "Original" },
                  { value: "derivative", label: "Derivative" },
                  { value: "repost", label: "Repost" },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm text-[#5b536d]">
                    <input
                      type="radio"
                      name="origin_type"
                      value={opt.value}
                      checked={originType === opt.value}
                      onChange={(e) => setOriginType(e.target.value)}
                      className="h-4 w-4 border-[#c8b6e5] text-ripple-500 focus:ring-ripple-400/40"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[#554b6a]">
                Tags (comma separated)
              </label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full rounded-2xl border border-[#dacdee] bg-white px-4 py-3 text-[15px] text-[#241b38] shadow-[inset_0_1px_2px_rgba(25,12,44,0.04)] outline-none transition-all placeholder:text-[#d2c6e3] focus:border-[#9a7ee0] focus:ring-4 focus:ring-[#8b5cf6]/12"
                placeholder="backend, architecture"
              />
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!file || !category || !recommendation || loading}
              className="w-full rounded-2xl bg-[linear-gradient(90deg,#7c4de0_0%,#9a62f6_100%)] py-3.5 text-base font-medium text-white shadow-[0_16px_36px_rgba(124,77,224,0.34)] transition-all duration-200 hover:translate-y-[-1px] hover:scale-[1.01] hover:shadow-[0_20px_42px_rgba(124,77,224,0.42)] active:translate-y-[1px] active:scale-[0.992] active:shadow-[0_10px_24px_rgba(124,77,224,0.28)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:hover:translate-y-0"
            >
              {loading ? "Uploading..." : "Upload Skill"}
            </button>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
}
