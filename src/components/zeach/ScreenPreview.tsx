"use client";

import { useEffect, useRef, useState } from "react";

interface ScreenPreviewProps {
  html: string;
  isLoading?: boolean;
  layoutBase?: "mobile" | "desktop";
  onReady?: () => void;
}

export function ScreenPreview({
  html,
  isLoading = false,
  layoutBase = "mobile",
  onReady,
}: ScreenPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);

  useEffect(() => {
    setIframeReady(false);
    if (!iframeRef.current || !html) return;

    const iframe = iframeRef.current;
    iframe.srcdoc = html;

    const handleLoad = () => {
      setIframeReady(true);
      onReady?.();
    };

    iframe.addEventListener("load", handleLoad);
    return () => iframe.removeEventListener("load", handleLoad);
  }, [html, onReady]);

  const isMobile = layoutBase === "mobile";

  return (
    <div className="relative flex items-center justify-center w-full h-full bg-[#1a1a2e] rounded-2xl overflow-hidden">
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#1a1a2e] gap-4">
          <div className="w-10 h-10 border-[3px] border-[#1e3a5f] border-t-[#06b6d4] rounded-full animate-spin" />
          <p className="text-sm font-semibold text-[#64748b]">Generating screen…</p>
        </div>
      )}

      {/* Empty state */}
      {!html && !isLoading && (
        <div className="flex flex-col items-center gap-3 text-[#334155]">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect
              x="8" y="8" width="32" height="32" rx="8"
              stroke="currentColor" strokeWidth="2" strokeDasharray="4 3"
            />
            <path
              d="M18 24h12M24 18v12"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            />
          </svg>
          <p className="text-sm font-medium">Preview will appear here</p>
        </div>
      )}

      {/* iframe wrapper */}
      {html && (
        <div
          style={{ opacity: iframeReady ? 1 : 0, transition: "opacity 0.3s ease" }}
          className={
            isMobile
              ? "w-[390px] h-[844px] rounded-[48px] overflow-hidden shadow-2xl border-[6px] border-[#0f172a]"
              : "w-full h-full"
          }
        >
          <iframe
            ref={iframeRef}
            className="w-full h-full border-0 bg-white"
            // allow-same-origin needed for Google Fonts / CDN links inside generated HTML
            sandbox="allow-scripts allow-same-origin"
            title="Zeach Screen Preview"
          />
        </div>
      )}
    </div>
  );
}
