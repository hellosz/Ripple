"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { Users, Boxes, BarChart3, ArrowLeft } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.push("/");
    }
  }, [user, loading, router]);

  if (loading || !user || user.role !== "admin") {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <ArrowLeft size={16} />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
        </div>
      </div>

      <nav className="flex border-b border-gray-200 dark:border-gray-700 gap-1">
        {[
          { href: "/admin", label: "Overview", icon: BarChart3 },
          { href: "/admin/users", label: "Users", icon: Users },
          { href: "/admin/skills", label: "Skills", icon: Boxes },
          { href: "/admin/stats", label: "Statistics", icon: BarChart3 },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border-b-2 border-transparent hover:border-ripple-500 transition-colors"
          >
            <item.icon size={14} />
            {item.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
