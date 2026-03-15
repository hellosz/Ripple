import type { Rating, SizeTier, OriginType } from "@/types";

export const RATING_CONFIG: Record<
  Rating,
  { label: string; emoji: string; color: string; bgColor: string }
> = {
  S: { label: "夯", emoji: "🟢", color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-950" },
  A: { label: "稳", emoji: "🔵", color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-950" },
  B: { label: "行", emoji: "🟡", color: "text-yellow-600", bgColor: "bg-yellow-50 dark:bg-yellow-950" },
  C: { label: "拉", emoji: "🔴", color: "text-red-600", bgColor: "bg-red-50 dark:bg-red-950" },
};

export const ORIGIN_LABELS: Record<OriginType, string> = {
  original: "原创",
  derivative: "二创",
  repost: "搬运",
};

export const SIZE_TIER_PX: Record<SizeTier, number> = {
  default: 16,
  small: 18,
  medium: 20,
  large: 24,
  xlarge: 28,
};

export const CATEGORY_LABELS: Record<string, string> = {
  engineering: "工程架构",
  github: "GitHub 工作流",
  tools: "工具链",
  design: "设计",
  data: "数据",
  ai: "AI",
};

export const CATEGORY_ICONS: Record<string, string> = {
  engineering: "🏗️",
  github: "🐙",
  tools: "🔧",
  design: "🎨",
  data: "📊",
  ai: "🤖",
};

export const ZODIAC_OPTIONS = [
  "白羊座", "金牛座", "双子座", "巨蟹座", "狮子座", "处女座",
  "天秤座", "天蝎座", "射手座", "摩羯座", "水瓶座", "双鱼座",
];

export const TAG_OPTIONS = [
  "前端", "后端", "产品", "设计", "数据", "AI", "运维", "测试", "管理",
];

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
