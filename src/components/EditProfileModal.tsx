"use client";

import { useState, useRef } from "react";
import { X, Camera, Loader2 } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { compressImage } from "@/utils/compress-image";
import { createClient } from "@/lib/supabase/client";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  currentAvatarUrl?: string | null;
  onSave: (newName: string, newAvatarUrl?: string) => void;
}

export default function EditProfileModal({
  isOpen,
  onClose,
  currentName,
  currentAvatarUrl,
  onSave,
}: EditProfileModalProps) {
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Avatar state
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5 MB");
      return;
    }

    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    e.target.value = "";
  }

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
      let newAvatarUrl: string | undefined;

      // Upload avatar if a new file was selected
      if (avatarFile) {
        const compressed = await compressImage(avatarFile);
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const userId = user?.id ?? "anonymous";
        const path = `avatars/${userId}.jpg`;

        // Upsert so re-uploads overwrite the old avatar
        const { error: uploadError } = await supabase.storage
          .from("mood-media")
          .upload(path, compressed, {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (uploadError) {
          console.error("Avatar upload failed:", uploadError);
          setError("Failed to upload avatar.");
          setLoading(false);
          return;
        }

        const { data: urlData } = supabase.storage
          .from("mood-media")
          .getPublicUrl(path);
        // Append cache-buster so browsers pick up the new image
        newAvatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      }

      // Build PATCH body
      const body: Record<string, string> = { display_name: trimmed };
      if (newAvatarUrl) body.avatar_url = newAvatarUrl;

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to update profile.");
        return;
      }

      onSave(trimmed, newAvatarUrl);
      // Reset
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarFile(null);
      setAvatarPreview(null);
      onClose();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  // Resolve what to show in the avatar preview
  const displayUrl = avatarPreview ?? currentAvatarUrl ?? null;

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

          {/* Avatar upload */}
          <div className="flex flex-col items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative group"
            >
              <UserAvatar url={displayUrl} name={currentName} size={80} />
              <div className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={22} className="text-white" />
              </div>
            </button>
            <span className="text-[12px] text-[#99a1af]">
              Tap to change avatar
            </span>
          </div>

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
              className="flex-1 h-[48px] rounded-[12px] bg-[#b8e6d5] text-[14px] font-medium text-[#2d6b59] transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
