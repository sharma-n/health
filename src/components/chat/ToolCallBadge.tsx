"use client";

export type ToolCall = {
  callId: string;
  name: string;
  ok?: boolean;
};

export function ToolCallBadge({ toolCall }: { toolCall: ToolCall }) {
  const statusColor =
    toolCall.ok === undefined
      ? "bg-muted text-muted-foreground"
      : toolCall.ok
        ? "bg-success/15 text-success"
        : "bg-destructive/15 text-destructive";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {toolCall.name}
    </span>
  );
}
