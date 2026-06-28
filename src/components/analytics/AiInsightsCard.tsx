export function AiInsightsCard({
  facts,
}: {
  facts: Record<string, string> | null;
}) {
  if (!facts || Object.keys(facts).length === 0) return null;
  const entries = Object.entries(facts).slice(0, 3);
  return (
    <div className="rounded-xl border border-border bg-card p-4 mb-5">
      <h3 className="text-sm font-semibold text-muted-foreground mb-2">
        What your coach knows about you
      </h3>
      <ul className="space-y-1">
        {entries.map(([k, v]) => (
          <li key={k} className="text-sm">
            <span className="font-medium capitalize">
              {k.replace(/_/g, " ")}
            </span>
            {": "}
            <span className="text-muted-foreground">{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
