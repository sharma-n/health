"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { MessageBubble, type Message } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import type { ToolCall } from "./ToolCallBadge";

type SseEvent =
  | { type: "text"; text: string }
  | { type: "tool_call"; call_id: string; name: string; arguments: string }
  | { type: "tool_result"; call_id: string; name: string; ok: boolean; content: string }
  | { type: "turn_complete"; iterations: number; stop_reason: string }
  | { type: "unknown" };

function storageKey(kind: "messages" | "convId", userId: string) {
  return `chat_${kind}_${userId}`;
}

export function ChatWindow({ userId }: { userId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState(`health-${userId}`);
  const [isStreaming, setIsStreaming] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      const savedId = localStorage.getItem(storageKey("convId", userId));
      if (savedId) setConversationId(savedId);
      const savedMsgs = localStorage.getItem(storageKey("messages", userId));
      if (savedMsgs) setMessages(JSON.parse(savedMsgs) as Message[]);
    } catch {
      // localStorage unavailable; continue without persistence
    }
    setHydrated(true);
  }, [userId]);

  // Persist messages whenever they change (skip before hydration to avoid overwriting)
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey("messages", userId), JSON.stringify(messages));
    } catch {}
  }, [messages, hydrated, userId]);

  // Persist conversationId whenever it changes
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey("convId", userId), conversationId);
    } catch {}
  }, [conversationId, hydrated, userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function startNewChat() {
    const newId = `health-${userId}-${Date.now()}`;
    setConversationId(newId);
    setMessages([]);
    try {
      localStorage.setItem(storageKey("convId", userId), newId);
      localStorage.removeItem(storageKey("messages", userId));
    } catch {}
  }

  async function sendMessage(text: string) {
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setIsStreaming(true);

    // Placeholder for the streaming assistant message
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "Unknown error");
        appendToLast(`[Error: ${errText}]`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const pendingToolCalls = new Map<string, ToolCall>();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let evt: SseEvent;
          try {
            evt = JSON.parse(raw) as SseEvent;
          } catch {
            continue;
          }

          if (evt.type === "text") {
            appendToLast(evt.text);
          } else if (evt.type === "tool_call") {
            pendingToolCalls.set(evt.call_id, { callId: evt.call_id, name: evt.name });
            flushToolCalls(pendingToolCalls);
          } else if (evt.type === "tool_result") {
            const tc = pendingToolCalls.get(evt.call_id);
            if (tc) {
              pendingToolCalls.set(evt.call_id, { ...tc, ok: evt.ok });
              flushToolCalls(pendingToolCalls);
            }
          } else if (evt.type === "turn_complete") {
            if (evt.stop_reason === "max_iterations") {
              appendToLast(
                "I ran out of steps before finishing — this task required too many tool calls for a single turn. " +
                  "Try breaking it into smaller parts (e.g. create the workouts first, then create the plan).",
              );
            }
            break;
          }
        }
      }
    } catch (err) {
      appendToLast(`[Connection error: ${err instanceof Error ? err.message : "unknown"}]`);
    } finally {
      setIsStreaming(false);
    }
  }

  function appendToLast(text: string) {
    setMessages((prev) => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last?.role === "assistant") {
        updated[updated.length - 1] = { ...last, content: last.content + text };
      }
      return updated;
    });
  }

  function flushToolCalls(toolCalls: Map<string, ToolCall>) {
    const calls = Array.from(toolCalls.values());
    setMessages((prev) => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last?.role === "assistant") {
        updated[updated.length - 1] = { ...last, toolCalls: calls };
      }
      return updated;
    });
  }

  return (
    <div className="flex h-[calc(100dvh-10rem)] flex-col">
      <div className="flex items-center justify-end px-1 pb-2">
        <button
          onClick={startNewChat}
          disabled={isStreaming}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="New chat"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
          New chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-4 px-1 py-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Ask me anything about your training, goals, or workout programming.
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {isStreaming && messages[messages.length - 1]?.content === "" && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5">
              <span className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <ChatInput onSend={sendMessage} disabled={isStreaming} />
    </div>
  );
}
