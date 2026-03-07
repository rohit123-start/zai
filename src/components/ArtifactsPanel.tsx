"use client";

import { useState } from "react";
import { Message } from "@/hooks/useChat";
import { useArtifacts } from "@/hooks/useArtifacts";
import ArtifactViewer from "./ArtifactViewer";

type Props = {
  messages: Message[];
  fullscreen: boolean;
  onToggleFullscreen: () => void;
};

const LANG_ICONS: Record<string, string> = {
  html: "🌐",
  jsx: "⚛️",
  tsx: "⚛️",
  css: "🎨",
  js: "📜",
  ts: "📘",
  python: "🐍",
  py: "🐍",
};

export default function ArtifactsPanel({ messages, fullscreen, onToggleFullscreen }: Props) {
  const artifacts = useArtifacts(messages);
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeArtifact =
    artifacts.find((a) => a.id === activeId) ?? artifacts[artifacts.length - 1];

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "#1a1a1a" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: "#2a2a2a" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: "#e5e5e5" }}>
            Artifacts
          </span>
          {artifacts.length > 0 && (
            <span
              className="px-1.5 py-0.5 text-xs rounded-full"
              style={{ background: "#2a2a2a", color: "#9ca3af" }}
            >
              {artifacts.length}
            </span>
          )}
        </div>

        <button
          onClick={onToggleFullscreen}
          title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          className="flex items-center justify-center w-7 h-7 rounded transition-all duration-150"
          style={{ color: "#6b7280", background: "transparent" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#e5e5e5";
            e.currentTarget.style.background = "#2a2a2a";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#6b7280";
            e.currentTarget.style.background = "transparent";
          }}
        >
          {fullscreen ? (
            /* Exit fullscreen icon */
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 14 10 14 10 20" />
              <polyline points="20 10 14 10 14 4" />
              <line x1="10" y1="14" x2="3" y2="21" />
              <line x1="21" y1="3" x2="14" y2="10" />
            </svg>
          ) : (
            /* Enter fullscreen icon */
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          )}
        </button>
      </div>

      {artifacts.length === 0 ? (
        /* Empty state */
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div style={{ color: "#3a3a3a" }}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          <p className="text-sm" style={{ color: "#6b7280" }}>
            Artifacts will appear here
          </p>
          <p className="text-xs text-center max-w-48" style={{ color: "#4b5563" }}>
            Ask Claude to build something and code will show up in this panel
          </p>
        </div>
      ) : (
        <div className="flex flex-col h-full overflow-hidden">
          {/* Tab bar */}
          <div
            className="flex items-center gap-1 px-2 py-1.5 border-b overflow-x-auto shrink-0"
            style={{ borderColor: "#2a2a2a", background: "#111" }}
          >
            {artifacts.map((artifact) => {
              const isActive =
                artifact.id === (activeArtifact?.id ?? artifacts[artifacts.length - 1]?.id);
              const icon = LANG_ICONS[artifact.language] ?? "📄";
              return (
                <button
                  key={artifact.id}
                  onClick={() => setActiveId(artifact.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs whitespace-nowrap transition-all duration-150 shrink-0"
                  style={{
                    background: isActive ? "#1a1a1a" : "transparent",
                    color: isActive ? "#e5e5e5" : "#6b7280",
                    borderBottom: isActive
                      ? "2px solid #d97706"
                      : "2px solid transparent",
                    borderRadius: "4px 4px 0 0",
                  }}
                >
                  <span>{icon}</span>
                  <span className="font-medium">{artifact.title}</span>
                  {artifact.partial && (
                    <span style={{ color: "#d97706", fontSize: "9px" }}>●</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Artifact viewer */}
          <div className="flex-1 overflow-hidden">
            {activeArtifact && (
              <ArtifactViewer key={activeArtifact.id} artifact={activeArtifact} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
