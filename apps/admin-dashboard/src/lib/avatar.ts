// Fallback avatar generator. Uses the user's stored avatar when available,
// otherwise generates a deterministic DiceBear avatar from a seed (name/handle).

export function avatarUrl(seed: string): string {
  return `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

// Prefer a real stored avatar; fall back to a seeded generated avatar.
export function resolveAvatar(avatar: string | null | undefined, seed: string): string {
  return avatar ?? avatarUrl(seed || "guest");
}
