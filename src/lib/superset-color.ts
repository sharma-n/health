export const SUPERSET_COLORS = [
  { border: "border-l-blue-400", bg: "bg-blue-500/10" },
  { border: "border-l-green-400", bg: "bg-green-500/10" },
  { border: "border-l-purple-400", bg: "bg-purple-500/10" },
  { border: "border-l-orange-400", bg: "bg-orange-500/10" },
  { border: "border-l-pink-400", bg: "bg-pink-500/10" },
  { border: "border-l-cyan-400", bg: "bg-cyan-500/10" },
];

export function getSupersetColor(group: string | null | undefined) {
  if (!group) return { border: "border-l-border", bg: "bg-surface-muted" };
  const hash = group.charCodeAt(0) + (group.charCodeAt(group.length - 1) || 0);
  return SUPERSET_COLORS[hash % SUPERSET_COLORS.length];
}
