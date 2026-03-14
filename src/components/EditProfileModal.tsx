"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  onSave: (newName: string) => void;
}

export default function EditProfileModal({
  isOpen,
  onClose,
  currentName,
  onSave,
}: EditProfileModalProps) {
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Display name cannot be empty.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to update profile.");
        return;
      }

      onSave(trimmed);
      onClose();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-5">
      <div className="w-full max-w-[400px] bg-white rounded-[24px] shadow-[0px_20px_25px_0px_rgba(0,0,0,0.1)] p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[16px] font-medium text-[#101828]">
            Edit Profile
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-[32px] h-[32px] flex items-center justify-center rounded-full hover:bg-[#f3f4f6] transition-colors"
            aria-label="Close"
          >
            <X size={20} className="text-[#6a7282]" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-[12px] bg-[#ffd4d4] px-4 py-3 text-[13px] text-[#9b4a4a]">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="display-name"
              className="block text-[13px] text-[#6a7282] mb-2"
            >
              Display Name
            </label>
            <input
              id="display-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-[48px] px-4 rounded-[12px] bg-[#f9fafb] border border-[#e5e7eb] text-[14px] text-[#364153] outline-none focus:ring-2 focus:ring-[#b8e6d5] transition-shadow"
              maxLength={50}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-[48px] rounded-[12px] bg-[#f3f4f6] text-[14px] font-medium text-[#6a7282] transition-colors hover:bg-[#e5e7eb]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-[48px] rounded-[12px] bg-[#b8e6d5] text-[14px] font-medium text-[#2d6b59] transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
