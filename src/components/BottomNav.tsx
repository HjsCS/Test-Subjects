"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, Plus, User } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [hasRequests, setHasRequests] = useState(false);

  const isMap = pathname === "/map" || pathname === "/";
  const isProfile = pathname === "/insights";
  const isFriends = pathname === "/friends";

  // Check for pending friend requests
  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/friends/requests");
        if (res.ok) {
          const data = await res.json();
          setHasRequests((data.incoming ?? []).length > 0);
        }
      } catch {
        // silent
      }
    }
    check();
    // Re-check when navigating back to map (e.g. after viewing friends)
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, [pathname]);

  // Hide nav on Profile and Friends pages
  if (isProfile || isFriends) return null;

  function handleAddMood() {
    if (isMap) {
      // Already on map — fire custom event to open modal directly
      window.dispatchEvent(new CustomEvent("openAddMood"));
    } else {
      // Navigate to map with query param
      router.push("/map?addMood=true");
    }
  }

  return (
    <nav className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom,1.5rem))] left-1/2 -translate-x-1/2 z-50 flex items-end gap-3 mb-4">
      {/* Home */}
      <Link
        href="/map"
        className="flex flex-col items-center justify-center gap-1 w-[64px] h-[64px] rounded-[20px] bg-white shadow-[0px_20px_25px_0px_rgba(0,0,0,0.1),0px_8px_10px_0px_rgba(0,0,0,0.1)] transition-colors"
      >
        <Home
          size={22}
          className={isMap ? "text-[#6baa96]" : "text-[#99a1af]"}
        />
        <span
          className={`text-[10px] font-medium leading-none ${
            isMap ? "text-[#6baa96]" : "text-[#99a1af]"
          }`}
        >
          Home
        </span>
      </Link>

      {/* Mood (Add) */}
      <button
        type="button"
        onClick={handleAddMood}
        className="flex flex-col items-center justify-center gap-1 w-[72px] h-[72px] rounded-[20px] bg-[#c8f0c8] shadow-[0px_20px_25px_0px_rgba(0,0,0,0.1),0px_8px_10px_0px_rgba(0,0,0,0.1)] transition-colors"
      >
        <Plus size={22} className="text-[#1e2939]" />
        <span className="text-[10px] font-medium leading-none text-[#1e2939]">
          Mood
        </span>
      </button>

      {/* Profile */}
      <Link
        href="/insights"
        className="relative flex flex-col items-center justify-center gap-1 w-[64px] h-[64px] rounded-[20px] bg-white shadow-[0px_20px_25px_0px_rgba(0,0,0,0.1),0px_8px_10px_0px_rgba(0,0,0,0.1)] transition-colors"
      >
        <User
          size={22}
          className={isProfile ? "text-[#6baa96]" : "text-[#99a1af]"}
        />
        <span
          className={`text-[10px] font-medium leading-none ${
            isProfile ? "text-[#6baa96]" : "text-[#99a1af]"
          }`}
        >
          Profile
        </span>
        {hasRequests && (
          <span className="absolute top-2 right-2 w-[10px] h-[10px] rounded-full bg-[#EF4444] shadow-[0_0_0_2px_white]" />
        )}
      </Link>
    </nav>
  );
}
