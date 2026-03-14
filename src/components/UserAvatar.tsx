/**
 * Reusable avatar component.
 *
 * - If `url` is provided → renders a circular image.
 * - Otherwise → renders the first letter of `name` on a gradient background.
 */

interface UserAvatarProps {
  url?: string | null;
  name: string;
  /** Diameter in pixels. Default 40. */
  size?: number;
  className?: string;
}

export default function UserAvatar({
  url,
  name,
  size = 40,
  className = "",
}: UserAvatarProps) {
  const fontSize = Math.max(Math.round(size * 0.4), 10);

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-gradient-to-br from-[#b8e6d5] to-[#ffe8b8] flex items-center justify-center shrink-0 font-medium text-[#6a7282] ${className}`}
      style={{ width: size, height: size, fontSize }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
