"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import ChatPanel from "@/components/ChatPanel";
import ArtifactsPanel from "@/components/ArtifactsPanel";
import { useChat } from "@/hooks/useChat";

const MIN_CHAT_PCT = 20;
const MAX_CHAT_PCT = 80;
const DEFAULT_CHAT_PCT = 60;

export default function Home() {
  const { messages, isStreaming, sendMessage, stopStreaming, clearMessages } = useChat();
  const [chatPct, setChatPct] = useState(DEFAULT_CHAT_PCT);
  const [artifactFullscreen, setArtifactFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setChatPct(Math.min(MAX_CHAT_PCT, Math.max(MIN_CHAT_PCT, pct)));
    };

    const onMouseUp = () => setIsDragging(false);

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      ref={containerRef}
      className="flex h-screen overflow-hidden"
      style={{
        background: "#0f0f0f",
        cursor: isDragging ? "col-resize" : "default",
        userSelect: isDragging ? "none" : "auto",
      }}
    >
      {/* Left: Chat */}
      <div
        className="flex flex-col h-full"
        style={{
          width: artifactFullscreen ? "0%" : `${chatPct}%`,
          overflow: "hidden",
          transition: artifactFullscreen ? "width 0.25s ease" : undefined,
        }}
      >
        <ChatPanel
          messages={messages}
          isStreaming={isStreaming}
          onSend={sendMessage}
          onStop={stopStreaming}
          onClear={clearMessages}
        />
      </div>

      {/* Drag handle */}
      {!artifactFullscreen && (
        <div
          onMouseDown={handleMouseDown}
          className="flex items-center justify-center h-full shrink-0"
          style={{
            width: "5px",
            cursor: "col-resize",
            background: isDragging ? "#d97706" : "#2a2a2a",
            transition: "background 0.15s",
            zIndex: 10,
          }}
          onMouseEnter={(e) => {
            if (!isDragging) e.currentTarget.style.background = "#3a3a3a";
          }}
          onMouseLeave={(e) => {
            if (!isDragging) e.currentTarget.style.background = "#2a2a2a";
          }}
        />
      )}

      {/* Right: Artifacts */}
      <div
        className="flex flex-col h-full"
        style={{
          width: artifactFullscreen ? "100%" : `${100 - chatPct}%`,
          transition: artifactFullscreen ? "width 0.25s ease" : undefined,
        }}
      >
        <ArtifactsPanel
          messages={messages}
          fullscreen={artifactFullscreen}
          onToggleFullscreen={() => setArtifactFullscreen((v) => !v)}
        />
      </div>
    </div>
  );
}
