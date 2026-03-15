"use client";

import { ArrowLeft, BookOpen, Terminal, Share2, Star, Zap, Code } from "lucide-react";
import Link from "next/link";

export default function GuidePage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <Link href="/" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
        <ArrowLeft size={16} /> Back to home
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Knowledge Guide</h1>
        <p className="text-gray-500 mt-1">Everything you need to know about AI Skills</p>
      </div>

      {/* What is a Skill */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen size={20} className="text-ripple-500" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">What is a Skill?</h2>
        </div>
        <div className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-400">
          <p>
            An AI Skill is a reusable package that gives AI agents specialized capabilities. Each skill contains:
          </p>
          <ul className="space-y-2">
            <li><strong>SKILL.md</strong> - The core prompt and instructions that define the skill&apos;s behavior</li>
            <li><strong>agents/</strong> - Configuration files for different AI platforms (OpenAI, Claude, etc.)</li>
            <li><strong>assets/</strong> - Supporting materials like diagrams and templates</li>
            <li><strong>scripts/</strong> - Automation scripts for setup and validation</li>
            <li><strong>references/</strong> - Additional documentation and specifications</li>
          </ul>
        </div>
      </section>

      {/* How to Use */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Terminal size={20} className="text-ripple-500" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">How to Install & Use</h2>
        </div>
        <div className="space-y-3">
          <div className="bg-gray-900 rounded-lg p-4">
            <code className="text-green-400 text-sm">
              $ npx skills add https://github.com/org/ripple --skill skill-name
            </code>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            That&apos;s it! The one-line command downloads and installs the skill into your local environment.
            You can also download skills as ZIP files from the detail page.
          </p>
        </div>
      </section>

      {/* Ripple Push */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Share2 size={20} className="text-ripple-500" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Ripple Push (RP)</h2>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
          <p>
            RP is Ripple&apos;s signature feature. After downloading and using a skill, you can RP it to
            spread the word. When you RP a skill:
          </p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>3-7 random users are selected as targets</li>
            <li>Online users receive instant push notifications</li>
            <li>Offline users see the notification when they next visit</li>
            <li>Each user can only RP a skill once</li>
          </ol>
          <p>
            Quality skills naturally spread through the community like ripples on water.
          </p>
        </div>
      </section>

      {/* Rating System */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Star size={20} className="text-ripple-500" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Quality Rating</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { emoji: "🟢", label: "S - 夯", desc: "Complete workflow, agents, decision rules, structured output" },
            { emoji: "🔵", label: "A - 稳", desc: "Good workflow coverage, adequate description, 3+ sections" },
            { emoji: "🟡", label: "B - 行", desc: "Basic structure with 2+ sections and reasonable description" },
            { emoji: "🔴", label: "C - 拉", desc: "Meets minimum requirements only (has SKILL.md with name/description)" },
          ].map((r) => (
            <div key={r.label} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <div className="flex items-center gap-2 mb-1">
                <span>{r.emoji}</span>
                <span className="font-medium text-gray-900 dark:text-white">{r.label}</span>
              </div>
              <p className="text-xs text-gray-500">{r.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Best Practices */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Code size={20} className="text-ripple-500" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Best Practices</h2>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
          <ul className="space-y-2">
            <li>Write clear, structured SKILL.md with proper sections</li>
            <li>Include a detailed Workflow section with step-by-step instructions</li>
            <li>Add Decision Rules so the AI knows when and how to apply the skill</li>
            <li>Provide example outputs and quality standards</li>
            <li>Include agent configuration files for easy deployment</li>
            <li>Keep descriptions concise but informative (50+ characters for top rating)</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
