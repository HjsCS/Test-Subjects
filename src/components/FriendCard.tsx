"use client";

import { UserMinus, Check, X, UserPlus, Clock } from "lucide-react";

interface FriendCardProps {
  displayName: string;
  avatarUrl?: string | null;
  /** The mode determines which action buttons to show */
  mode: "friend" | "incoming" | "outgoing" | "search";
  /** Whether a request is already pending (for search mode) */
  isPending?: boolean;
  /** Whether already friends (for search mode) */
  isFriend?: boolean;
  loading?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  onRemove?: () => void;
  onAdd?: () => void;
}

export default function FriendCard({
  displayName,
  mode,
  isPending,
  isFriend,
  loading,
  onAccept,
  onReject,
  onRemove,
  onAdd,
}: FriendCardProps) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-[16px] shadow-[0px_2px_12px_0px_rgba(0,0,0,0.06)] px-4 py-3">
      {/* Avatar */}
      <div className="w-[44px] h-[44px] rounded-full bg-gradient-to-br from-[#b8e6d5] to-[#ffe8b8] flex items-center justify-center text-lg shrink-0">
        {displayName.charAt(0).toUpperCase()}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium text-[#101828] truncate">
          {displayName}
        </p>
        {mode === "incoming" && (
          <p className="text-[12px] text-[#6a7282]">wants to be your friend</p>
        )}
        {mode === "outgoing" && (
          <p className="text-[12px] text-[#6a7282]">request sent</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 shrink-0">
        {mode === "friend" && (
          <button
            type="button"
            onClick={onRemove}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 h-[34px] rounded-full bg-[#f3f4f6] text-[12px] font-medium text-[#6a7282] hover:bg-[#ffd4d4] hover:text-[#9b4a4a] transition-colors disabled:opacity-50"
          >
            <UserMinus size={14} />
            Remove
          </button>
        )}

        {mode === "incoming" && (
          <>
            <button
              type="button"
              onClick={onAccept}
              disabled={loading}
              className="flex items-center justify-center w-[34px] h-[34px] rounded-full bg-[#b8e6d5] text-[#2d6b59] hover:bg-[#9dd9c3] transition-colors disabled:opacity-50"
              aria-label="Accept"
            >
              <Check size={16} />
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={loading}
              className="flex items-center justify-center w-[34px] h-[34px] rounded-full bg-[#f3f4f6] text-[#6a7282] hover:bg-[#ffd4d4] hover:text-[#9b4a4a] transition-colors disabled:opacity-50"
              aria-label="Reject"
            >
              <X size={16} />
            </button>
          </>
        )}

        {mode === "outgoing" && (
          <button
            type="button"
            onClick={onRemove}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 h-[34px] rounded-full bg-[#f3f4f6] text-[12px] font-medium text-[#6a7282] hover:bg-[#ffd4d4] hover:text-[#9b4a4a] transition-colors disabled:opacity-50"
          >
            <X size={14} />
            Cancel
          </button>
        )}

        {mode === "search" && !isFriend && !isPending && (
          <button
            type="button"
            onClick={onAdd}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 h-[34px] rounded-full bg-[#b8e6d5] text-[12px] font-medium text-[#2d6b59] hover:bg-[#9dd9c3] transition-colors disabled:opacity-50"
          >
            <UserPlus size={14} />
            Add
          </button>
        )}

        {mode === "search" && isPending && (
          <span className="flex items-center gap-1.5 px-3 h-[34px] rounded-full bg-[#ffe8b8] text-[12px] font-medium text-[#9d7d3f]">
            <Clock size={14} />
            Pending
          </span>
        )}

        {mode === "search" && isFriend && (
          <span className="flex items-center gap-1.5 px-3 h-[34px] rounded-full bg-[#b8e6d5] text-[12px] font-medium text-[#2d6b59]">
            <Check size={14} />
            Friends
          </span>
        )}
      </div>
    </div>
  );
}
