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

  /* ── User message ──────────────────────────────────────────────────────── */
  if (isUser) {
    const hasImages = message.images && message.images.length > 0;
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
        <div
          style={{
            background: "#161616",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "12px 12px 3px 12px",
            maxWidth: "90%",
            overflow: "hidden",
          }}
        >
          {hasImages && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: message.images!.length === 1 ? "1fr" : "1fr 1fr",
                gap: 2,
                padding: 4,
              }}
            >
              {message.images!.map((img, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={img.preview}
                  alt={`uploaded image ${i + 1}`}
                  style={{ width: "100%", objectFit: "cover", maxHeight: 200, borderRadius: 6, display: "block" }}
                />
              ))}
            </div>
          )}
          {message.content && message.content !== "(no text)" && (
            <div
              style={{
                padding: hasImages ? "6px 12px 9px" : "9px 12px",
                fontSize: 13,
                color: "#fff",
                lineHeight: 1.5,
                fontFamily: "var(--font-dm-sans)",
              }}
            >
              {message.content}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Assistant message ─────────────────────────────────────────────────── */
  const strippedContent = message.content ? stripCodeBlocks(message.content) : "";
  const isThinking = isEmpty && isStreaming;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {/* "Zeach" label with cyan dot */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontFamily: "var(--font-dm-mono)",
          fontSize: 9,
          color: "#3f3f46",
        }}
      >
        <div
          style={{
            width: 6, height: 6, borderRadius: "50%", background: "#06b6d4",
            animation: isThinking ? "zaiPulse 1.5s ease-in-out infinite" : undefined,
          }}
        />
        Zeach
      </div>

      {/* Bubble */}
      <div
        style={{
          background: "rgba(6,182,212,0.08)",
          border: "1px solid rgba(6,182,212,0.12)",
          borderRadius: "3px 12px 12px 12px",
          padding: "9px 12px",
          maxWidth: "95%",
        }}
      >
        {isThinking ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 0" }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 5, height: 5, borderRadius: "50%", background: "#06b6d4",
                  opacity: 0.3,
                  animation: "typingBounce 1.2s ease-in-out infinite",
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
        ) : strippedContent ? (
          <div
            className={isStreaming ? "streaming-cursor" : ""}
            style={{
              fontSize: 13,
              color: "#a1a1aa",
              lineHeight: 1.55,
              fontFamily: "var(--font-dm-sans)",
            }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                code({ inline, className, children, ...props }: any) {
                  return (
                    <code
                      className={className}
                      style={{
                        background: inline ? "rgba(255,255,255,0.07)" : "transparent",
                        padding: inline ? "0.1em 0.35em" : undefined,
                        borderRadius: "3px",
                        fontFamily: "var(--font-dm-mono)",
                        fontSize: "0.88em",
                        color: "#06b6d4",
                      }}
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                strong({ children }) {
                  return <strong style={{ color: "#fff", fontWeight: 500 }}>{children}</strong>;
                },
                p({ children }) {
                  return <p style={{ margin: "0 0 6px", color: "#a1a1aa" }}>{children}</p>;
                },
              }}
            >
              {strippedContent}
            </ReactMarkdown>
          </div>
        ) : (
          <span style={{ color: "#3f3f46", fontSize: 13 }}>…</span>
        )}
      </div>
    </div>
  );
}
