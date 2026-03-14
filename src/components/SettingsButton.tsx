"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Settings, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SettingsButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-[40px] h-[40px] flex items-center justify-center rounded-full hover:bg-[#f3f4f6] transition-colors"
        aria-label="Settings"
      >
        <Settings size={20} className="text-[#364153]" />
      </button>

      {open && (
        <div className="absolute top-[44px] right-0 z-50 w-[160px] bg-white rounded-[16px] shadow-[0px_8px_24px_rgba(0,0,0,0.12)] p-2">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[12px] text-[13px] font-medium text-[#9b4a4a] hover:bg-[#ffd4d4] transition-colors"
          >
            <LogOut size={16} />
            Log Out
          </button>
        </div>
      )}
    </div>
  );
}
