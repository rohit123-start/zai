"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message } from "@/hooks/useChat";

const LANG_LABELS: Record<string, string> = {
  html: "HTML", jsx: "JSX", tsx: "TSX", css: "CSS",
  js: "JavaScript", ts: "TypeScript", python: "Python", py: "Python",
};

function stripCodeBlocks(content: string): string {
  let result = content.replace(/```(\w+)?\n[\s\S]*?```/g, (_, lang) => {
    const label = lang ? (LANG_LABELS[lang.toLowerCase()] ?? lang.toUpperCase()) : "Code";
    return `\`[${label} artifact ↗]\``;
  });
  result = result.replace(/```[\s\S]*$/, "");
  return result.trim();
}

type Props = {
  message: Message;
  isStreaming?: boolean;
};

export default function MessageBubble({ message, isStreaming }: Props) {
  const isUser = message.role === "user";
  const isEmpty = !message.content || message.content === "";

  if (isUser) {
    const hasImages = message.images && message.images.length > 0;
    return (
      <div className="flex justify-end mb-4 message-in">
        <div
          className="max-w-[75%] text-sm leading-relaxed overflow-hidden"
          style={{
            background: "#2a2a2a",
            color: "#e5e5e5",
            borderRadius: "12px 12px 2px 12px",
          }}
        >
          {hasImages && (
            <div className={`grid gap-1 p-1 ${message.images!.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
              {message.images!.map((img, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={img.preview}
                  alt={`uploaded image ${i + 1}`}
                  className="w-full object-cover"
                  style={{ maxHeight: "240px", borderRadius: "8px", display: "block" }}
                />
              ))}
            </div>
          )}
          {message.content && message.content !== "(no text)" && (
            <div className={hasImages ? "px-4 pb-2.5 pt-1" : "px-4 py-2.5"}>
              {message.content}
            </div>
          )}
        </div>
      </div>
    );
  }

  const strippedContent = message.content ? stripCodeBlocks(message.content) : "";
  const isThinking = isEmpty && isStreaming;

  return (
    <div className="flex justify-start mb-4 message-in">
      {/* Zai avatar */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5 mr-2"
        style={{
          background: "#d97706",
          color: "#0f0f0f",
          letterSpacing: "-0.5px",
          boxShadow: isThinking ? "0 0 0 0 rgba(217,119,6,0.5)" : undefined,
          animation: isThinking ? "zaiPulse 1.5s ease-in-out infinite" : undefined,
        }}
      >
        Z
      </div>

      <div
        className="max-w-[85%] px-4 py-2.5 text-sm prose-dark"
        style={{
          background: "#1f1f1f",
          color: "#e5e5e5",
          borderRadius: "12px 12px 12px 2px",
          border: "1px solid #2a2a2a",
        }}
      >
        {isThinking ? (
          /* Thinking state — animated dots */
          <div className="flex items-center gap-1.5 py-0.5">
            <span className="typing-dot w-2 h-2 rounded-full inline-block" style={{ background: "#d97706" }} />
            <span className="typing-dot w-2 h-2 rounded-full inline-block" style={{ background: "#d97706" }} />
            <span className="typing-dot w-2 h-2 rounded-full inline-block" style={{ background: "#d97706" }} />
          </div>
        ) : strippedContent ? (
          <div className={isStreaming ? "streaming-cursor" : ""}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                code({ inline, className, children, ...props }: any) {
                  return (
                    <code
                      className={className}
                      style={{
                        background: inline ? "#2a2a2a" : "transparent",
                        padding: inline ? "0.15em 0.4em" : undefined,
                        borderRadius: "3px",
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.875em",
                        color: "#d97706",
                      }}
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {strippedContent}
            </ReactMarkdown>
          </div>
        ) : (
          <span style={{ color: "#4b5563" }}>…</span>
        )}
      </div>
    </div>
  );
}
