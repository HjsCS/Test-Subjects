"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Users, Bell } from "lucide-react";
import FriendCard from "@/components/FriendCard";
import type { FriendshipWithProfile, Profile } from "@/types/database";

type Tab = "friends" | "requests";

export default function FriendsPage() {
  const [tab, setTab] = useState<Tab>("friends");
  const [friends, setFriends] = useState<FriendshipWithProfile[]>([]);
  const [incoming, setIncoming] = useState<FriendshipWithProfile[]>([]);
  const [outgoing, setOutgoing] = useState<FriendshipWithProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Track which users have pending requests or are already friends
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const loadFriends = useCallback(async () => {
    try {
      const res = await fetch("/api/friends");
      if (res.ok) {
        const data = await res.json();
        setFriends(data);
        const ids = new Set<string>(
          data.map((f: FriendshipWithProfile) =>
            f.profiles?.id,
          ).filter(Boolean),
        );
        setFriendIds(ids);
      }
    } catch (err) {
      console.error("Failed to load friends:", err);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/friends/requests");
      if (res.ok) {
        const data = await res.json();
        setIncoming(data.incoming ?? []);
        setOutgoing(data.outgoing ?? []);
        const ids = new Set<string>(
          [
            ...(data.incoming ?? []).map((r: FriendshipWithProfile) => r.profiles?.id),
            ...(data.outgoing ?? []).map((r: FriendshipWithProfile) => r.profiles?.id),
          ].filter(Boolean),
        );
        setPendingIds(ids);
      }
    } catch (err) {
      console.error("Failed to load requests:", err);
    }
  }, []);

  useEffect(() => {
    loadFriends();
    loadRequests();
  }, [loadFriends, loadRequests]);

  // Search users
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
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function handleSendRequest(addresseeId: string) {
    setLoadingId(addresseeId);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addressee_id: addresseeId }),
      });
      if (res.ok) {
        setPendingIds((prev) => new Set(prev).add(addresseeId));
        await loadRequests();
      }
    } catch (err) {
      console.error("Failed to send request:", err);
    } finally {
      setLoadingId(null);
    }
  }

  async function handleAccept(id: string) {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/friends/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "accepted" }),
      });
      if (res.ok) {
        await loadFriends();
        await loadRequests();
      }
    } catch (err) {
      console.error("Failed to accept:", err);
    } finally {
      setLoadingId(null);
    }
  }

  async function handleReject(id: string) {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/friends/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      });
      if (res.ok) {
        await loadRequests();
      }
    } catch (err) {
      console.error("Failed to reject:", err);
    } finally {
      setLoadingId(null);
    }
  }

  async function handleRemove(id: string) {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/friends/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await loadFriends();
        await loadRequests();
      }
    } catch (err) {
      console.error("Failed to remove:", err);
    } finally {
      setLoadingId(null);
    }
  }

  const isSearchActive = searchQuery.trim().length > 0;

  return (
    <div className="bg-[#fefbf6] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-center px-5 pt-[50px] pb-4">
        <span className="text-[16px] font-medium text-[#101828]">Friends</span>
      </div>

      {/* Search bar */}
      <div className="px-5 mb-4">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#99a1af]"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users by name..."
            className="w-full h-[48px] pl-11 pr-4 rounded-[16px] bg-white shadow-[0px_2px_12px_0px_rgba(0,0,0,0.06)] text-[14px] text-[#364153] placeholder-[#99a1af] outline-none focus:ring-2 focus:ring-[#b8e6d5] transition-shadow"
          />
        </div>
      </div>

      {/* Search results */}
      {isSearchActive && (
        <div className="px-5 mb-4">
          <h3 className="text-[13px] font-medium text-[#6a7282] mb-3">
            {searching
              ? "Searching..."
              : searchResults.length > 0
                ? `${searchResults.length} user${searchResults.length > 1 ? "s" : ""} found`
                : "No users found"}
          </h3>
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

      {/* Tabs */}
      {!isSearchActive && (
        <>
          <div className="flex gap-0 px-5 mb-4">
            <button
              type="button"
              onClick={() => setTab("friends")}
              className={`flex-1 flex items-center justify-center gap-2 h-[42px] rounded-l-[12px] text-[13px] font-medium transition-colors ${
                tab === "friends"
                  ? "bg-[#b8e6d5] text-[#2d6b59]"
                  : "bg-white text-[#6a7282] shadow-[0px_2px_12px_0px_rgba(0,0,0,0.06)]"
              }`}
            >
              <Users size={16} />
              Friends ({friends.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("requests")}
              className={`flex-1 flex items-center justify-center gap-2 h-[42px] rounded-r-[12px] text-[13px] font-medium transition-colors ${
                tab === "requests"
                  ? "bg-[#b8e6d5] text-[#2d6b59]"
                  : "bg-white text-[#6a7282] shadow-[0px_2px_12px_0px_rgba(0,0,0,0.06)]"
              }`}
            >
              <Bell size={16} />
              Requests
              {incoming.length > 0 && (
                <span className="w-[20px] h-[20px] rounded-full bg-[#e89b9b] text-white text-[11px] flex items-center justify-center">
                  {incoming.length}
                </span>
              )}
            </button>
          </div>

          {/* Friends tab */}
          {tab === "friends" && (
            <div className="px-5 flex flex-col gap-2 pb-[120px]">
              {friends.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <Users size={48} className="text-[#d1d5db]" />
                  <p className="text-[14px] text-[#6a7282]">
                    No friends yet. Search for people to connect!
                  </p>
                </div>
              ) : (
                friends.map((f) => (
                  <FriendCard
                    key={f.id}
                    displayName={f.profiles?.display_name ?? "Unknown"}
                    avatarUrl={f.profiles?.avatar_url}
                    mode="friend"
                    loading={loadingId === f.id}
                    onRemove={() => handleRemove(f.id)}
                  />
                ))
              )}
            </div>
          )}

          {/* Requests tab */}
          {tab === "requests" && (
            <div className="px-5 flex flex-col gap-4 pb-[120px]">
              {/* Incoming */}
              <div>
                <h3 className="text-[13px] font-medium text-[#6a7282] mb-2">
                  Received ({incoming.length})
                </h3>
                {incoming.length === 0 ? (
                  <p className="text-[13px] text-[#99a1af] py-4 text-center">
                    No pending requests
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {incoming.map((r) => (
                      <FriendCard
                        key={r.id}
                        displayName={r.profiles?.display_name ?? "Unknown"}
                        avatarUrl={r.profiles?.avatar_url}
                        mode="incoming"
                        loading={loadingId === r.id}
                        onAccept={() => handleAccept(r.id)}
                        onReject={() => handleReject(r.id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Outgoing */}
              <div>
                <h3 className="text-[13px] font-medium text-[#6a7282] mb-2">
                  Sent ({outgoing.length})
                </h3>
                {outgoing.length === 0 ? (
                  <p className="text-[13px] text-[#99a1af] py-4 text-center">
                    No sent requests
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {outgoing.map((r) => (
                      <FriendCard
                        key={r.id}
                        displayName={r.profiles?.display_name ?? "Unknown"}
                        avatarUrl={r.profiles?.avatar_url}
                        mode="outgoing"
                        loading={loadingId === r.id}
                        onRemove={() => handleRemove(r.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
