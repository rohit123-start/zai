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
      <div className="flex-1 overflow-hidden">
        {view === "code" ? (
          <div className="h-full overflow-auto">
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
              lineNumberStyle={{
                color: "#3a3a3a",
                minWidth: "2.5em",
              }}
            >
              {artifact.content}
            </SyntaxHighlighter>
          </div>
        ) : (
          <iframe
            srcDoc={artifact.content}
            sandbox="allow-scripts"
            className="w-full h-full border-0"
            style={{ background: "#fff" }}
            title={artifact.title}
          />
        )}
      </div>
    </div>
  );
}
