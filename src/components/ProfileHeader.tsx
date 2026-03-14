"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import EditProfileModal from "@/components/EditProfileModal";
import LogoutButton from "@/components/LogoutButton";

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
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(displayName);

  return (
    <>
      {/* Profile Card */}
      <div className="mx-0 bg-white rounded-[24px] shadow-[0px_2px_12px_0px_rgba(0,0,0,0.06)] px-6 py-7 flex items-center gap-4">
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
            <span className="bg-[#e8d4f8] text-[#9b72c0] text-[11px] px-[11px] py-[5px] rounded-full">
              {friendCount} Friends
            </span>
          </div>
        </div>
      </div>

      {/* Logout */}
      <div className="mx-0 flex justify-end">
        <LogoutButton />
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
