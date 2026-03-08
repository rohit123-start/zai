"use client";

import { useState, useCallback } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Artifact } from "@/utils/parseArtifacts";

type Props = {
  artifact: Artifact;
};

export default function ArtifactViewer({ artifact }: Props) {
  const canPreview = artifact.language === "html";
  const [view, setView] = useState<"code" | "preview">(canPreview ? "preview" : "code");
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(artifact.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  }, [artifact.content]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b shrink-0"
        style={{ borderColor: "#2a2a2a", background: "#111" }}
      >
        <div className="flex items-center gap-1">
          {(["code", ...(canPreview ? ["preview" as const] : [])] as const).map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setView(tab)}
                className="px-3 py-1 text-xs font-medium capitalize transition-all duration-150"
                style={{
                  color: view === tab ? "#d97706" : "#6b7280",
                  borderBottom:
                    view === tab ? "2px solid #d97706" : "2px solid transparent",
                }}
              >
                {tab}
              </button>
            )
          )}
        </div>

        <button
          onClick={handleCopy}
          className="px-3 py-1 text-xs font-medium rounded transition-all duration-150"
          style={{
            background: copied ? "#166534" : "#2a2a2a",
            color: copied ? "#86efac" : "#9ca3af",
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {view === "code" ? (
          <div className="h-full overflow-auto fade-in">
            <SyntaxHighlighter
              language={artifact.language}
              style={atomDark}
              showLineNumbers
              customStyle={{
                margin: 0,
                borderRadius: 0,
                background: "#0d0d0d",
                fontSize: "0.8rem",
                height: "100%",
                minHeight: "100%",
              }}
              lineNumberStyle={{ color: "#3a3a3a", minWidth: "2.5em" }}
            >
              {artifact.content}
            </SyntaxHighlighter>

            {/* Streaming shimmer overlay on code view */}
            {artifact.partial && (
              <div
                className="absolute bottom-0 left-0 right-0 pointer-events-none"
                style={{ height: "120px", background: "linear-gradient(to top, #0d0d0d 20%, transparent)" }}
              >
                <div className="px-6 pt-6 space-y-2">
                  {[70, 50, 85].map((w, i) => (
                    <div
                      key={i}
                      className="shimmer-bg rounded"
                      style={{ height: "10px", width: `${w}%`, opacity: 0.4 }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : artifact.partial ? (
          /* Shimmer skeleton while HTML streams in */
          <div className="h-full p-6 space-y-4" style={{ background: "#fff" }}>
            {/* Nav skeleton */}
            <div className="flex items-center justify-between mb-6">
              <div className="shimmer-bg rounded" style={{ height: "20px", width: "80px" }} />
              <div className="flex gap-3">
                {[60, 50, 70].map((w, i) => (
                  <div key={i} className="shimmer-bg rounded" style={{ height: "14px", width: `${w}px` }} />
                ))}
              </div>
            </div>
            {/* Hero skeleton */}
            <div className="shimmer-bg rounded-lg" style={{ height: "48px", width: "60%" }} />
            <div className="shimmer-bg rounded-lg" style={{ height: "28px", width: "45%" }} />
            <div className="space-y-2 mt-2">
              <div className="shimmer-bg rounded" style={{ height: "16px", width: "80%" }} />
              <div className="shimmer-bg rounded" style={{ height: "16px", width: "65%" }} />
            </div>
            <div className="flex gap-3 mt-4">
              <div className="shimmer-bg rounded-lg" style={{ height: "44px", width: "140px" }} />
              <div className="shimmer-bg rounded-lg" style={{ height: "44px", width: "110px" }} />
            </div>
            {/* Cards skeleton */}
            <div className="grid grid-cols-3 gap-4 mt-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="shimmer-bg rounded-xl" style={{ height: "120px" }} />
              ))}
            </div>
            {/* Building label */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full"
              style={{ background: "rgba(217,119,6,0.1)", border: "1px solid rgba(217,119,6,0.2)" }}>
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: "#d97706", animation: "streamingGlow 0.8s ease-in-out infinite" }}
              />
              <span className="text-xs font-medium" style={{ color: "#d97706" }}>
                Zai is building…
              </span>
            </div>
          </div>
        ) : (
          <iframe
            key="preview"
            srcDoc={artifact.content}
            sandbox="allow-scripts"
            className="w-full h-full border-0 fade-in"
            style={{ background: "#fff" }}
            title={artifact.title}
          />
        )}
      </div>
    </div>
  );
}
