"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Search, LogOut, Users, ChevronRight } from "lucide-react";
import EditProfileModal from "@/components/EditProfileModal";
import FriendCard from "@/components/FriendCard";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

interface ProfileHeaderProps {
  displayName: string;
  email: string;
  totalEntries: number;
  friendCount: number;
}

export default function ProfileHeader({
  displayName,
  email,
  totalEntries,
  friendCount,
}: ProfileHeaderProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(displayName);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Friend search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  // Close settings on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        settingsRef.current &&
        !settingsRef.current.contains(e.target as Node)
      ) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load friend/pending IDs for search status
  useEffect(() => {
    async function loadRelationships() {
      try {
        const [friendsRes, requestsRes] = await Promise.all([
          fetch("/api/friends"),
          fetch("/api/friends/requests"),
        ]);
        if (friendsRes.ok) {
          const data = await friendsRes.json();
          setFriendIds(
            new Set(
              data
                .map((f: { profiles?: { id: string } }) => f.profiles?.id)
                .filter(Boolean),
            ),
          );
        }
        if (requestsRes.ok) {
          const data = await requestsRes.json();
          setPendingIds(
            new Set(
              [
                ...(data.incoming ?? []).map(
                  (r: { profiles?: { id: string } }) => r.profiles?.id,
                ),
                ...(data.outgoing ?? []).map(
                  (r: { profiles?: { id: string } }) => r.profiles?.id,
                ),
              ].filter(Boolean),
            ),
          );
        }
      } catch {
        // silent
      }
    }
    loadRelationships();
  }, []);

  // Search users (debounced)
  useEffect(() => {
    if (searchQuery.trim().length < 1) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(searchQuery.trim())}`,
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch {
        // silent
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSendRequest = useCallback(async (addresseeId: string) => {
    setLoadingId(addresseeId);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addressee_id: addresseeId }),
      });
      if (res.ok) {
        setPendingIds((prev) => new Set(prev).add(addresseeId));
      }
    } catch {
      // silent
    } finally {
      setLoadingId(null);
    }
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const isSearchActive = searchQuery.trim().length > 0;

  return (
    <>
      {/* Profile Card */}
      <div className="bg-white rounded-[24px] shadow-[0px_2px_12px_0px_rgba(0,0,0,0.06)] px-6 py-7 flex items-center gap-4">
        <div className="w-[80px] h-[80px] rounded-full bg-gradient-to-br from-[#b8e6d5] to-[#ffe8b8] flex items-center justify-center text-3xl shrink-0">
          🫧
        </div>
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-medium text-[#101828] truncate">
              {name}
            </h2>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="shrink-0 w-[28px] h-[28px] flex items-center justify-center rounded-full hover:bg-[#f3f4f6] transition-colors"
              aria-label="Edit profile"
            >
              <Pencil size={14} className="text-[#6a7282]" />
            </button>
          </div>
          <p className="text-[13px] text-[#6a7282] truncate">{email}</p>
          <div className="flex gap-2 flex-wrap">
            <span className="bg-[#b8e6d5] text-[#6baa96] text-[11px] px-[11px] py-[5px] rounded-full">
              Level {Math.min(Math.floor(totalEntries / 5) + 1, 10)}
            </span>
            <span className="bg-[#ffe8b8] text-[#e8b963] text-[11px] px-[11px] py-[5px] rounded-full">
              {totalEntries} Entries
            </span>
            <button
              type="button"
              onClick={() => router.push("/friends")}
              className="bg-[#e8d4f8] text-[#9b72c0] text-[11px] px-[11px] py-[5px] rounded-full flex items-center gap-1 hover:bg-[#ddc3f0] transition-colors"
            >
              <Users size={11} />
              {friendCount} Friends
              <ChevronRight size={11} />
            </button>
          </div>
        </div>
      </div>

      {/* Friend Search Bar */}
      <div>
        <div className="relative">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#99a1af]"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search friends by name..."
            className="w-full h-[48px] pl-11 pr-4 rounded-[16px] bg-white shadow-[0px_2px_12px_0px_rgba(0,0,0,0.06)] text-[14px] text-[#364153] placeholder-[#99a1af] outline-none focus:ring-2 focus:ring-[#b8e6d5] transition-shadow"
          />
        </div>

        {/* Search results */}
        {isSearchActive && (
          <div className="mt-3">
            <p className="text-[13px] font-medium text-[#6a7282] mb-2">
              {searching
                ? "Searching..."
                : searchResults.length > 0
                  ? `${searchResults.length} user${searchResults.length > 1 ? "s" : ""} found`
                  : "No users found"}
            </p>
            <div className="flex flex-col gap-2">
              {searchResults.map((profile) => (
                <FriendCard
                  key={profile.id}
                  displayName={profile.display_name}
                  avatarUrl={profile.avatar_url}
                  mode="search"
                  isFriend={friendIds.has(profile.id)}
                  isPending={pendingIds.has(profile.id)}
                  loading={loadingId === profile.id}
                  onAdd={() => handleSendRequest(profile.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        currentName={name}
        onSave={(newName) => setName(newName)}
      />
    </>
  );
}
