"use client";

import { ToolCallBadge, type ToolCall } from "./ToolCallBadge";

export type Message = {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
};

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] space-y-1.5 rounded-2xl px-4 py-2.5 text-sm ${
          isUser
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-muted text-foreground"
        }`}
      >
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1 pb-1">
            {message.toolCalls.map((tc) => (
              <ToolCallBadge key={tc.callId} toolCall={tc} />
            ))}
          </div>
        )}
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
      </div>
    </div>
  );
}
