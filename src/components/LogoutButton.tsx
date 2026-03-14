"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="flex items-center gap-2 px-4 h-[40px] rounded-[12px] bg-[#ffd4d4] text-[13px] font-medium text-[#9b4a4a] transition-colors hover:bg-[#ffbfbf]"
    >
      <LogOut size={16} />
      Log Out
    </button>
  );
}
