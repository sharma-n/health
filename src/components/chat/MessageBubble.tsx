"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ToolCallBadge, type ToolCall } from "./ToolCallBadge";

export type Message = {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
};

function AssistantContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) =>
          href?.startsWith("/") ? (
            <Link href={href} className="underline hover:no-underline">
              {children}
            </Link>
          ) : (
            <a href={href} target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">
              {children}
            </a>
          ),
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="mb-2 list-disc pl-4 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 list-decimal pl-4 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        h1: ({ children }) => <h1 className="mb-2 mt-1 text-base font-bold">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-1.5 mt-1 text-sm font-bold">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-1 mt-1 text-sm font-semibold">{children}</h3>,
        pre: ({ children }) => (
          <pre className="mb-2 overflow-x-auto rounded-lg bg-black/10 p-3 text-xs font-mono">
            {children}
          </pre>
        ),
        code: ({ children, className }) =>
          className ? (
            <code className={className}>{children}</code>
          ) : (
            <code className="rounded bg-black/10 px-1 py-0.5 text-xs font-mono">{children}</code>
          ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

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
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        ) : (
          <AssistantContent content={message.content} />
        )}
      </div>
    </div>
  );
}
