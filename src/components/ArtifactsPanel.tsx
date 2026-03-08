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

const LANG_ICONS: Record<string, React.ReactNode> = {
  html: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M1.5 0h21l-1.91 21.563L11.977 24l-8.564-2.438L1.5 0zm7.031 9.75l-.232-2.718 10.059.003.23-2.622L5.412 4.41l.698 8.01h9.126l-.326 3.426-2.91.804-2.955-.81-.188-2.11H6.248l.33 4.171L12 19.351l5.379-1.443.744-8.157H8.531z"/></svg>
  ),
  jsx: <span style={{ fontSize: "10px", fontWeight: 700 }}>JSX</span>,
  tsx: <span style={{ fontSize: "10px", fontWeight: 700 }}>TSX</span>,
  css: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M1.5 0h21l-1.91 21.563L11.977 24l-8.565-2.438L1.5 0zm17.09 4.413L5.41 4.41l.213 2.622 10.125.002-.255 2.716h-6.64l.24 2.573h6.182l-.366 3.523-2.91.804-2.956-.81-.188-2.11h-2.61l.33 4.171L12 19.351l5.379-1.443.744-8.157H8.531l-.232-2.718 10.059.003.23-2.622z"/></svg>
  ),
  js: <span style={{ fontSize: "10px", fontWeight: 700 }}>JS</span>,
  ts: <span style={{ fontSize: "10px", fontWeight: 700 }}>TS</span>,
  python: <span style={{ fontSize: "10px", fontWeight: 700 }}>PY</span>,
  py: <span style={{ fontSize: "10px", fontWeight: 700 }}>PY</span>,
};

function DefaultIcon() {
  return <span style={{ fontSize: "10px", fontWeight: 700 }}>{"</>"}</span>;
}

export default function ArtifactsPanel({ messages, fullscreen, onToggleFullscreen }: Props) {
  const artifacts = useArtifacts(messages);
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeArtifact =
    artifacts.find((a) => a.id === activeId) ?? artifacts[artifacts.length - 1];

  const isStreaming = artifacts.some((a) => a.partial);

  return (
    <div className="flex flex-col h-full" style={{ background: "#1a1a1a" }}>
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
              {artifacts.filter((a) => !a.partial).length}
            </span>
          )}
          {isStreaming && (
            <span
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
              style={{ background: "rgba(217,119,6,0.12)", color: "#d97706", border: "1px solid rgba(217,119,6,0.2)" }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "#d97706", animation: "streamingGlow 0.8s ease-in-out infinite" }}
              />
              Building…
            </span>
          )}
        </div>

        <button
          onClick={onToggleFullscreen}
          title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          className="flex items-center justify-center w-7 h-7 rounded transition-all duration-150"
          style={{ color: "#6b7280", background: "transparent" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#e5e5e5"; e.currentTarget.style.background = "#2a2a2a"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#6b7280"; e.currentTarget.style.background = "transparent"; }}
        >
          {fullscreen ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" />
              <line x1="10" y1="14" x2="3" y2="21" /><line x1="21" y1="3" x2="14" y2="10" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          )}
        </button>
      </div>

      {artifacts.length === 0 ? (
        /* Empty state */
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "#111", border: "1px solid #2a2a2a" }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3a3a3a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: "#6b7280" }}>
              No artifacts yet
            </p>
            <p className="text-xs mt-1 max-w-44 text-center leading-relaxed" style={{ color: "#4b5563" }}>
              Ask Zai to build a UI, app, or component and it will appear here
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full overflow-hidden">
          {/* Tab bar */}
          <div
            className="flex items-center gap-1 px-2 py-1.5 border-b overflow-x-auto shrink-0"
            style={{ borderColor: "#2a2a2a", background: "#111" }}
          >
            {artifacts.map((artifact) => {
              const isActive = artifact.id === (activeArtifact?.id ?? artifacts[artifacts.length - 1]?.id);
              const icon = LANG_ICONS[artifact.language] ?? <DefaultIcon />;
              return (
                <button
                  key={artifact.id}
                  onClick={() => setActiveId(artifact.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs whitespace-nowrap transition-all duration-150 shrink-0"
                  style={{
                    background: isActive ? "#1a1a1a" : "transparent",
                    color: isActive ? "#e5e5e5" : "#6b7280",
                    borderBottom: isActive ? "2px solid #d97706" : "2px solid transparent",
                    borderRadius: "4px 4px 0 0",
                  }}
                >
                  <span style={{ color: isActive ? "#d97706" : "#6b7280" }}>{icon}</span>
                  <span className="font-medium">{artifact.title}</span>
                  {artifact.partial && (
                    <span
                      className="w-1.5 h-1.5 rounded-full ml-0.5"
                      style={{ background: "#d97706", animation: "streamingGlow 0.8s ease-in-out infinite", display: "inline-block" }}
                    />
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
