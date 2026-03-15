"use client";

import { useState } from "react";
import { Upload, X } from "lucide-react";
import { skills as skillsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { SkillRating } from "./SkillRating";
import type { Rating } from "@/types";

interface SkillUploadFormProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export function SkillUploadForm({ onClose, onSuccess }: SkillUploadFormProps) {
  const { requireAuth } = useAuth();
  const [file, setFile] = useState<File | null>(null);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Upload Skill
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X size={18} />
          </button>
        </div>

        {result ? (
          <div className="p-6 space-y-4">
            <div className="text-center">
              <div className="text-2xl mb-2">Upload Successful!</div>
              <p className="text-gray-600 dark:text-gray-400">
                <strong>{result.name}</strong> has been published
              </p>
              <div className="mt-2">
                <SkillRating rating={result.rating} size="md" />
              </div>
            </div>
            {result.suggestions && result.suggestions.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-950 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                  Improvement Suggestions
                </h4>
                <ul className="space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
                  {result.suggestions.map((s, i) => (
                    <li key={i}>- {s}</li>
                  ))}
                </ul>
              </div>
            )}
            <button
              onClick={onClose}
              className="w-full py-2 rounded-lg bg-ripple-500 text-white hover:bg-ripple-600 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Skill Package (ZIP)
              </label>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload size={24} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">
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

            {/* Recommendation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Author Recommendation
              </label>
              <textarea
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-ripple-500"
                rows={2}
                placeholder="Describe why this skill is great..."
                required
              />
            </div>

            {/* Origin Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Origin
              </label>
              <div className="flex gap-3">
                {[
                  { value: "original", label: "Original" },
                  { value: "derivative", label: "Derivative" },
                  { value: "repost", label: "Repost" },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name="origin_type"
                      value={opt.value}
                      checked={originType === opt.value}
                      onChange={(e) => setOriginType(e.target.value)}
                      className="text-ripple-500"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tags (comma separated)
              </label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-ripple-500"
                placeholder="backend, architecture"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950 rounded-lg p-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!file || !recommendation || loading}
              className="w-full py-2.5 rounded-lg bg-ripple-500 text-white font-medium hover:bg-ripple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Uploading..." : "Upload Skill"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
