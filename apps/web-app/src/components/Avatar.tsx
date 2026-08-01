import React, { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export interface AvatarProps {
  src?: string | null;
  alt?: string;
  name?: string | null;
  handle?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
}

const BG_COLORS = [
  "#d97706",
  "#0891b2",
  "#059669",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#2563eb",
  "#16a34a",
];

const SIZE_MAP: Record<NonNullable<AvatarProps["size"]>, string> = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
  xl: "size-16 text-lg",
  "2xl": "size-20 text-2xl",
};

function getInitials(
  name: string | null | undefined,
  handle: string | null | undefined,
): string {
  const source = (name && name.trim()) || (handle && handle.trim());
  if (!source) return "?";

  const trimmed = source.trim();

  if (/^[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/.test(trimmed)) {
    return trimmed.charAt(0).toUpperCase();
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }

  return trimmed.charAt(0).toUpperCase();
}

function getColorIndex(text: string | null | undefined): number {
  if (!text) return 0;
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash % BG_COLORS.length;
}

export function Avatar({
  src,
  alt = "",
  name,
  handle,
  size = "md",
  className,
}: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initials = useMemo(() => getInitials(name, handle), [name, handle]);
  const bgColor = useMemo(
    () => BG_COLORS[getColorIndex(name || handle)],
    [name, handle],
  );
  const sizeClass = SIZE_MAP[size];

  const hasValidImage = src && !imgError;

  if (hasValidImage) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn(
          "rounded-full object-cover flex-shrink-0",
          sizeClass,
          className,
        )}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0 select-none",
        sizeClass,
        className,
      )}
      style={{ backgroundColor: bgColor }}
      aria-label={alt || name || handle || "User avatar"}
    >
      {initials}
    </div>
  );
}

export default Avatar;
