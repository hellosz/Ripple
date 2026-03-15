"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { users as usersApi } from "@/lib/api";
import { ProfileSetup } from "@/components/user/ProfileSetup";
import { RippleVisualization } from "@/components/user/RippleVisualization";
import { UserAvatar } from "@/components/user/UserAvatar";
import { SkillRating } from "@/components/skill/SkillRating";
import { formatDate } from "@/lib/utils";
import { LogOut, Edit3 } from "lucide-react";
import type { RippleRecord } from "@/types";

type Tab = "likes" | "downloads" | "ripples";

export default function UserProfilePage() {
  const { user, loading, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("likes");
  const [likes, setLikes] = useState<any[]>([]);
  const [downloads, setDownloads] = useState<any[]>([]);
  const [ripples, setRipples] = useState<RippleRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    setDataLoading(true);
    const fetcher = tab === "likes" ? usersApi.myLikes() :
                    tab === "downloads" ? usersApi.myDownloads() :
                    usersApi.myRipples();

    fetcher.then((data) => {
      if (tab === "likes") setLikes(data);
      else if (tab === "downloads") setDownloads(data);
      else setRipples(data);
    }).catch(() => {}).finally(() => setDataLoading(false));
  }, [tab, user]);

  if (loading || !user) {
    return <div className="animate-pulse space-y-4">
      <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl" />
    </div>;
  }

  const needsSetup = !user.nickname;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Profile Card */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start gap-4">
          <UserAvatar user={user as any} size={56} />
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {user.nickname || user.email.split("@")[0]}
            </h2>
            {user.description && (
              <p className="text-sm text-gray-500 mt-0.5">{user.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-500">
              <span>{user.email}</span>
              {user.zodiac && <span>| {user.zodiac}</span>}
              {user.tags && (user.tags as string[]).map((tag) => (
                <span key={tag} className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800">{tag}</span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSetup(true)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
              title="Edit Profile"
            >
              <Edit3 size={16} />
            </button>
            <button
              onClick={() => { logout(); router.push("/"); }}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Setup flow for new users */}
      {(needsSetup || showSetup) && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <ProfileSetup onComplete={() => { setShowSetup(false); refreshUser(); }} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {[
          { key: "likes" as Tab, label: "My Likes" },
          { key: "downloads" as Tab, label: "My Downloads" },
          { key: "ripples" as Tab, label: "My RP" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-ripple-500 text-ripple-600 dark:text-ripple-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {dataLoading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg" />)}
        </div>
      ) : (
        <>
          {tab === "likes" && (
            <div className="space-y-3">
              {likes.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No liked skills yet</p>
              ) : likes.map((item) => (
                <a key={item.id} href={`/skill/${item.name}`} className="block bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-gray-300 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">{item.display_name}</span>
                    <SkillRating rating={item.rating} />
                  </div>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-1">{item.description}</p>
                </a>
              ))}
            </div>
          )}

          {tab === "downloads" && (
            <div className="space-y-3">
              {downloads.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No downloads yet</p>
              ) : downloads.map((item) => (
                <a key={item.id} href={`/skill/${item.name}`} className="block bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-gray-300 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">{item.display_name}</span>
                    <SkillRating rating={item.rating} />
                    <span className="text-xs text-gray-400 ml-auto">v{item.version}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-1">{item.description}</p>
                  <p className="text-xs text-gray-400 mt-1">Downloaded {formatDate(item.downloaded_at)}</p>
                </a>
              ))}
            </div>
          )}

          {tab === "ripples" && (
            <div className="space-y-4">
              {ripples.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No RP activity yet</p>
              ) : ripples.map((ripple) => (
                <RippleVisualization key={ripple.id} ripple={ripple} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
