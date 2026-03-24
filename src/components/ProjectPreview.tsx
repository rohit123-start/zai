"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { type ProjectFile } from "@/lib/db";
import { type Message } from "@/hooks/useChat";
import {
  parseFilesFromText,
  isMultiFileResponse,
  getFileCategory,
  getDisplayName,
  type ParsedFile,
} from "@/utils/parseFiles";
import { buildFileMap, stitchPage, fileLanguage, resolveNavigationTarget } from "@/utils/stitcher";

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = "preview" | "code" | "files";
type ViewportSize = "mobile" | "tablet" | "desktop";

type Props = {
  files: ProjectFile[];
  pagesLoading: boolean;
  messages: Message[];
  isStreaming: boolean;
  isThinking?: boolean;
  /** When true, shows a subtle "generating…" badge without blocking the preview */
  isGeneratingBackground?: boolean;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
};

// ─── Viewport config ──────────────────────────────────────────────────────────

const VIEWPORTS: { id: ViewportSize; label: string; width: string; icon: React.ReactNode }[] = [
  {
    id: "mobile", label: "Mobile", width: "375px",
    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>,
  },
  {
    id: "tablet", label: "Tablet", width: "768px",
    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>,
  },
  {
    id: "desktop", label: "Desktop", width: "100%",
    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>,
  },
];

// ─── File tree icons ──────────────────────────────────────────────────────────

function FileIcon({ path }: { path: string }) {
  const cat = getFileCategory(path);
  const color =
    cat === "page" ? "#60a5fa" :
    cat === "component" ? "#a78bfa" :
    cat === "style" ? "#34d399" :
    cat === "script" ? "#fbbf24" :
    cat === "data" ? "#f472b6" : "#9ca3af";

  if (cat === "page" || cat === "component") return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  );
  if (cat === "style") return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M8 12h8M12 8v8" />
    </svg>
  );
  if (cat === "script") return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
    </svg>
  );
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    </svg>
  );
}

function FolderIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="#d97706" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ) : (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function FullscreenIcon({ exit }: { exit: boolean }) {
  return exit ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" />
      <line x1="10" y1="14" x2="3" y2="21" /><line x1="21" y1="3" x2="14" y2="10" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

// ─── Zai loading state (matches chat panel design) ───────────────────────────

function ZaiLoading({ label, thinking }: { label?: string; thinking?: boolean }) {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-5"
      style={{ background: "#0d0d0d" }}
    >
      {/* Z logo */}
      <div
        style={{
          width: 48, height: 48, borderRadius: 14,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: thinking ? "rgba(168,85,247,0.1)" : "rgba(6,182,212,0.1)",
          border: `1px solid ${thinking ? "rgba(168,85,247,0.25)" : "rgba(6,182,212,0.25)"}`,
          color: thinking ? "#a855f7" : "#06b6d4",
          fontFamily: "var(--font-space-grotesk)",
          fontSize: 20, fontWeight: 900, letterSpacing: "-0.5px",
          animation: "zaiPulse 2s ease-in-out infinite",
          transition: "all 0.4s ease",
        }}
      >
        Z
      </div>

      {/* Label */}
      <div className="text-center" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 14, fontWeight: 600, color: "#fff", letterSpacing: "-0.2px" }}>
          {thinking ? "Analyzing project…" : label ? `Building ${label}` : "Zai is loading…"}
        </p>
        <p style={{ fontFamily: "var(--font-dm-mono)", fontSize: 11, color: thinking ? "#a855f7" : "#3f3f46", transition: "color 0.4s" }}>
          {thinking ? "validating design & planning screens" : "writing files"}
        </p>
      </div>

      {/* Typing dots */}
      <div style={{ display: "flex", gap: 5 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 5, height: 5, borderRadius: "50%",
              background: thinking ? "#a855f7" : "#06b6d4",
              opacity: 0.4,
              animation: "typingBounce 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.2}s`,
              transition: "background 0.4s",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ fullscreen, onToggleFullscreen, loading }: { fullscreen: boolean; onToggleFullscreen: () => void; loading: boolean }) {
  return (
    <div className="flex flex-col h-full" style={{ background: "#141414" }}>
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: "#252525" }}>
        <span className="text-sm font-semibold" style={{ color: "#e5e5e5" }}>Preview</span>
        <button onClick={onToggleFullscreen} className="flex items-center justify-center w-7 h-7 rounded" style={{ color: "#6b7280" }}>
          <FullscreenIcon exit={fullscreen} />
        </button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        {loading ? (
          <ZaiLoading />
        ) : (
          <>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3a3a3a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: "#6b7280" }}>No pages yet</p>
              <p className="text-xs mt-1 max-w-[180px] leading-relaxed" style={{ color: "#4b5563" }}>
                Ask Zai to build a website or app
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── File Tree ────────────────────────────────────────────────────────────────

function FileTree({
  allFiles,
  selectedPath,
  streamingPaths,
  onSelect,
}: {
  allFiles: { path: string; partial?: boolean }[];
  selectedPath: string | null;
  streamingPaths: Set<string>;
  onSelect: (path: string) => void;
}) {
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set(["pages", "components", "styles", "scripts"]));

  const folderMap = useMemo(() => {
    const map = new Map<string, { path: string; partial?: boolean }[]>();
    for (const f of allFiles) {
      const folder = f.path.includes("/") ? f.path.split("/")[0] : "root";
      if (!map.has(folder)) map.set(folder, []);
      map.get(folder)!.push(f);
    }
    return map;
  }, [allFiles]);

  const toggleFolder = (folder: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      next.has(folder) ? next.delete(folder) : next.add(folder);
      return next;
    });
  };

  const FOLDER_ORDER = ["pages", "components", "styles", "scripts"];
  const folders = [
    ...FOLDER_ORDER.filter((f) => folderMap.has(f)),
    ...[...folderMap.keys()].filter((f) => !FOLDER_ORDER.includes(f)),
  ];

  return (
    <div className="flex flex-col gap-0.5 py-2 px-1 overflow-y-auto" style={{ fontSize: "12px" }}>
      {folders.map((folder) => {
        const isOpen = openFolders.has(folder);
        const folderFiles = folderMap.get(folder) ?? [];
        return (
          <div key={folder}>
            {/* Folder header */}
            <button
              onClick={() => toggleFolder(folder)}
              className="flex items-center gap-1.5 w-full px-2 py-1 rounded transition-colors duration-100"
              style={{ color: "#9ca3af" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#1f1f1f"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
                <path d="M2 1l4 3-4 3V1z" />
              </svg>
              <FolderIcon open={isOpen} />
              <span className="font-medium" style={{ color: isOpen ? "#d97706" : "#6b7280" }}>{folder}/</span>
            </button>

            {/* Files */}
            {isOpen && folderFiles.map((f) => {
              const isActive = f.path === selectedPath;
              const isStreaming = streamingPaths.has(f.path);
              const name = f.path.split("/").pop() ?? f.path;
              return (
                <button
                  key={f.path}
                  onClick={() => onSelect(f.path)}
                  className="flex items-center gap-1.5 w-full px-2 py-1 rounded ml-4 transition-colors duration-100"
                  style={{
                    background: isActive ? "rgba(217,119,6,0.1)" : "transparent",
                    color: isActive ? "#e5e5e5" : "#9ca3af",
                    borderLeft: isActive ? "2px solid #d97706" : "2px solid transparent",
                  }}
                  onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = "#1f1f1f"; e.currentTarget.style.color = "#d1d5db"; } }}
                  onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9ca3af"; } }}
                >
                  <FileIcon path={f.path} />
                  <span className="flex-1 text-left truncate">{name}</span>
                  {isStreaming && (
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#d97706", animation: "streamingGlow 0.8s ease-in-out infinite" }} />
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── Generation progress bar ─────────────────────────────────────────────────

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProjectPreview({
  files,
  pagesLoading,
  messages,
  isStreaming,
  isThinking = false,
  isGeneratingBackground = false,
  fullscreen,
  onToggleFullscreen,
}: Props) {
  const [activePageName, setActivePageName] = useState<string | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [viewport, setViewport] = useState<ViewportSize>("desktop");
  const [copied, setCopied] = useState(false);
  const [screensDdOpen, setScreensDdOpen] = useState(false);
  const screensDdRef = useRef<HTMLDivElement>(null);
  const [iframeKey, setIframeKey] = useState(0);

  // Detect streaming multi-file format
  const lastAssistantContent = messages.findLast?.((m) => m.role === "assistant")?.content ?? "";
  const streamIsMultiFile = isStreaming && isMultiFileResponse(lastAssistantContent);

  // Parse streaming files (for live preview during stream)
  const streamingFiles: ParsedFile[] = useMemo(() => {
    if (!streamIsMultiFile) return [];
    return parseFilesFromText(lastAssistantContent, isStreaming);
  }, [lastAssistantContent, streamIsMultiFile, isStreaming]);

  const streamingFileMap = new Map(streamingFiles.map((f) => [f.path, f]));
  const streamingPaths = new Set(streamingFiles.map((f) => f.path));

  // Track partial page being written (for shimmer label)
  const partialPage = streamingFiles.find((f) => f.partial && f.path.startsWith("pages/"));

  // ── Determine pages to show ────────────────────────────────────────────────

  const dbFilePaths = files.map((f) => f.file_path);
  const dbPagePaths = dbFilePaths.filter((p) => p.startsWith("pages/") && p.endsWith(".html"));

  const streamingPagePaths = [...streamingPaths].filter((p) => p.startsWith("pages/") && p.endsWith(".html"));
  const newStreamingPagePaths = streamingPagePaths.filter((p) => !dbPagePaths.includes(p));

  const allPageTabs: string[] = [
    ...dbPagePaths,
    ...newStreamingPagePaths,
  ];

  // Show generating state as soon as streaming starts (even before first FILE: marker appears)
  const hasAnyStreaming = isStreaming && (streamIsMultiFile || files.length === 0);

  // Resolve active page tab
  const activeTab =
    activePageName && allPageTabs.includes(activePageName)
      ? activePageName
      : allPageTabs[0] ?? null;

  // ── Resolve content for rendering ─────────────────────────────────────────

  function resolveContent(): { html: string; isPartial: boolean; lang: string } | null {
    if (viewMode === "files" && selectedFilePath) {
      const streamFile = streamingFileMap.get(selectedFilePath);
      if (streamFile) return { html: streamFile.content, isPartial: !!streamFile.partial, lang: fileLanguage(selectedFilePath) };
      const dbFile = files.find((f) => f.file_path === selectedFilePath);
      if (dbFile) return { html: dbFile.content, isPartial: false, lang: fileLanguage(selectedFilePath) };
      return null;
    }

    if (!activeTab) return null;

    if (viewMode === "code") {
      const streaming = streamingFileMap.get(activeTab);
      if (streaming) return { html: streaming.content, isPartial: !!streaming.partial, lang: "html" };
      const dbFile = files.find((f) => f.file_path === activeTab);
      if (dbFile) return { html: dbFile.content, isPartial: false, lang: "html" };
      return null;
    }

    // Preview mode
    const streamingPage = streamingFileMap.get(activeTab);
    if (streamingPage?.partial) {
      return { html: streamingPage.content, isPartial: true, lang: "html" };
    }

    // New flow: file is a complete self-contained HTML — show directly, no stitching needed
    const dbFile = files.find((f) => f.file_path === activeTab);
    if (dbFile?.content.trimStart().startsWith("<!DOCTYPE")) {
      return { html: dbFile.content, isPartial: false, lang: "html" };
    }

    // Legacy multi-file flow: stitch CSS/JS into the page
    const mergedMap = buildFileMap([
      ...files.map((f) => ({ file_path: f.file_path, content: f.content })),
      ...streamingFiles.map((f) => ({ file_path: f.path, content: f.content })),
    ]);
    const stitched = stitchPage(activeTab, mergedMap);
    return stitched ? { html: stitched, isPartial: false, lang: "html" } : null;
  }

  const activeContent = resolveContent();

  // ── Page switch ────────────────────────────────────────────────────────────
  const switchPage = useCallback((name: string) => {
    setActivePageName(name);
  }, []);

  // ── Close screens dropdown on outside click ─────────────────────────────────
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (screensDdRef.current && !screensDdRef.current.contains(e.target as Node)) {
        setScreensDdOpen(false);
      }
    }
    if (screensDdOpen) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [screensDdOpen]);

  // ── Listen for navigation messages from iframes ────────────────────────────
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!e.data || e.data.type !== "zai-navigate") return;
      const target = resolveNavigationTarget(String(e.data.page), allPageTabs);
      if (target) setActivePageName(target);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [allPageTabs]);

  const handleCopy = useCallback(async () => {
    if (!activeContent) return;
    try {
      await navigator.clipboard.writeText(activeContent.html);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard not available */ }
  }, [activeContent]);

  // ── All files for tree view ────────────────────────────────────────────────
  const allFilesForTree: { path: string; partial?: boolean }[] = [
    ...files.map((f) => ({ path: f.file_path })),
    ...streamingFiles
      .filter((f) => !files.some((df) => df.file_path === f.path))
      .map((f) => ({ path: f.path, partial: f.partial })),
  ];

  const totalPageCount = allPageTabs.length;
  const hasContent = totalPageCount > 0 || allFilesForTree.length > 0;

  // Show spinner while DB is still fetching — never flash empty state prematurely
  if (pagesLoading) {
    return <EmptyState fullscreen={fullscreen} onToggleFullscreen={onToggleFullscreen} loading={true} />;
  }

  if (!hasContent && !hasAnyStreaming) {
    return <EmptyState fullscreen={fullscreen} onToggleFullscreen={onToggleFullscreen} loading={false} />;
  }

  const viewportWidth = VIEWPORTS.find((v) => v.id === viewport)?.width ?? "100%";

  return (
    <div className="flex flex-col h-full" style={{ background: "#141414" }}>

      {/* ── Top bar ── */}
      <div
        className="flex items-stretch shrink-0"
        style={{ height: 52, borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.96)" }}
      >
        {/* Left: view toggle */}
        <div
          className="flex items-center shrink-0"
          style={{ padding: "0 12px", borderRight: "1px solid rgba(255,255,255,0.06)", gap: 2 }}
        >
          {/* View toggle pill */}
          <div
            style={{
              display: "flex", alignItems: "center",
              background: "#111", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8, padding: 2, gap: 1,
            }}
          >
            {[
              {
                id: "preview" as ViewMode, title: "Preview",
                icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
              },
              {
                id: "code" as ViewMode, title: "Code",
                icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
              },
              {
                id: "files" as ViewMode, title: "Files",
                icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
              },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => setViewMode(v.id)}
                title={v.title}
                style={{
                  width: 28, height: 26, borderRadius: 6,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: viewMode === v.id ? "#1a1a1a" : "transparent",
                  color: viewMode === v.id ? "#fff" : "#3f3f46",
                  border: "none", cursor: "pointer",
                  boxShadow: viewMode === v.id ? "0 1px 3px rgba(0,0,0,0.4)" : "none",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { if (viewMode !== v.id) e.currentTarget.style.color = "#71717a"; }}
                onMouseLeave={(e) => { if (viewMode !== v.id) e.currentTarget.style.color = "#3f3f46"; }}
              >
                {v.icon}
              </button>
            ))}
          </div>
        </div>

        {/* Center: screens dropdown + separator + viewport icons */}
        <div
          className="flex-1 flex items-center justify-center"
          style={{ gap: 0, minWidth: 0, padding: "0 4px" }}
        >
          {/* Screens dropdown */}
          <div style={{ position: "relative", flexShrink: 0 }} ref={screensDdRef}>
            <button
              onClick={() => { if (allPageTabs.length > 0) setScreensDdOpen((o) => !o); }}
              title="Switch screen"
              style={{
                display: "flex", alignItems: "center", gap: 6,
                fontFamily: "var(--font-dm-mono)", fontSize: 10, fontWeight: 500,
                color: allPageTabs.length > 0 ? "#e5e5e5" : "#3f3f46",
                background: screensDdOpen ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, padding: "4px 10px",
                cursor: allPageTabs.length > 0 ? "pointer" : "default",
                transition: "all 0.15s", minWidth: 110,
              }}
              onMouseEnter={(e) => { if (allPageTabs.length > 0) e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = screensDdOpen ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)"; }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>
                {allPageTabs.length === 0
                  ? "No screens"
                  : activeTab
                    ? getDisplayName(activeTab)
                    : `${totalPageCount} screen${totalPageCount !== 1 ? "s" : ""}`}
              </span>
              {allPageTabs.length > 0 && (
                <span style={{ color: "#06b6d4", background: "rgba(6,182,212,0.12)", borderRadius: 6, padding: "0 5px", fontSize: 9 }}>
                  {totalPageCount}
                </span>
              )}
              {hasAnyStreaming && (
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#06b6d4", animation: "streamingGlow 0.8s ease-in-out infinite", display: "inline-block", flexShrink: 0 }} />
              )}
              {allPageTabs.length > 0 && (
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5, transform: screensDdOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              )}
            </button>

            {/* Dropdown list */}
            {screensDdOpen && allPageTabs.length > 0 && (
              <div
                style={{
                  position: "absolute", top: "calc(100% + 6px)", left: "50%",
                  transform: "translateX(-50%)",
                  background: "#161616", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10, padding: "4px", zIndex: 200,
                  minWidth: 180, maxHeight: 280, overflowY: "auto",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                }}
              >
                {allPageTabs.map((tab) => {
                  const isActive = tab === activeTab;
                  const label = getDisplayName(tab);
                  const isTabStreaming = streamingPaths.has(tab) && streamingFileMap.get(tab)?.partial;
                  return (
                    <button
                      key={tab}
                      onClick={() => {
                        switchPage(tab);
                        if (viewMode === "files") setViewMode("preview");
                        setScreensDdOpen(false);
                      }}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, width: "100%",
                        padding: "7px 10px", borderRadius: 7, border: "none", cursor: "pointer",
                        background: isActive ? "rgba(6,182,212,0.1)" : "transparent",
                        color: isActive ? "#06b6d4" : "#a1a1aa",
                        fontFamily: "var(--font-dm-mono)", fontSize: 11,
                        textAlign: "left", transition: "all 0.1s",
                      }}
                      onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#e5e5e5"; } }}
                      onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#a1a1aa"; } }}
                    >
                      <FileIcon path={tab} />
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
                      {isTabStreaming && (
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#06b6d4", animation: "streamingGlow 0.8s ease-in-out infinite", flexShrink: 0 }} />
                      )}
                      {isActive && (
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Background generation indicator */}
          {isGeneratingBackground && (
            <div
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "3px 8px", borderRadius: 6,
                background: "rgba(6,182,212,0.08)",
                border: "1px solid rgba(6,182,212,0.2)",
                marginLeft: 8, flexShrink: 0,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#06b6d4", animation: "streamingGlow 0.8s ease-in-out infinite", flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: "#06b6d4", fontFamily: "var(--font-dm-mono)", whiteSpace: "nowrap" }}>generating…</span>
            </div>
          )}

          {/* Separator */}
          <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.06)", margin: "0 10px", flexShrink: 0 }} />

          {/* Viewport icons */}
          <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
            {VIEWPORTS.map((vp) => (
              <button
                key={vp.id}
                onClick={() => setViewport(vp.id)}
                title={vp.label}
                style={{
                  width: 30, height: 28, borderRadius: 7,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                  background: viewport === vp.id ? "rgba(6,182,212,0.1)" : "transparent",
                  border: viewport === vp.id ? "1px solid rgba(6,182,212,0.25)" : "1px solid transparent",
                  color: viewport === vp.id ? "#06b6d4" : "#3f3f46",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { if (viewport !== vp.id) { e.currentTarget.style.color = "#71717a"; e.currentTarget.style.background = "#111"; } }}
                onMouseLeave={(e) => { if (viewport !== vp.id) { e.currentTarget.style.color = "#3f3f46"; e.currentTarget.style.background = "transparent"; } }}
              >
                {vp.icon}
              </button>
            ))}
          </div>
        </div>

        {/* Right: fullscreen button */}
        <div
          className="flex items-center shrink-0"
          style={{ padding: "0 12px", borderLeft: "1px solid rgba(255,255,255,0.06)", gap: 6 }}
        >
          {/* Copy button (when code view is active) */}
          {(viewMode === "code" || viewMode === "files") && activeContent && (
            <button
              onClick={handleCopy}
              title="Copy code"
              style={{
                display: "flex", alignItems: "center", gap: 5,
                fontFamily: "var(--font-dm-mono)", fontSize: 10, fontWeight: 500,
                color: copied ? "#10b981" : "#71717a",
                background: copied ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${copied ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 7, padding: "4px 10px", cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { if (!copied) { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; } }}
              onMouseLeave={(e) => { if (!copied) { e.currentTarget.style.color = "#71717a"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; } }}
            >
              {copied ? (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Copied
                </>
              ) : (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  Copy
                </>
              )}
            </button>
          )}

          {/* Fullscreen button — prominent */}
          <button
            onClick={onToggleFullscreen}
            title={fullscreen ? "Exit fullscreen" : "Full screen preview"}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 32, height: 32, borderRadius: 8, cursor: "pointer",
              background: fullscreen ? "rgba(6,182,212,0.1)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${fullscreen ? "rgba(6,182,212,0.25)" : "rgba(255,255,255,0.08)"}`,
              color: fullscreen ? "#06b6d4" : "#71717a",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!fullscreen) {
                e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                e.currentTarget.style.color = "#fff";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
              }
            }}
            onMouseLeave={(e) => {
              if (!fullscreen) {
                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                e.currentTarget.style.color = "#71717a";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
              }
            }}
          >
            <FullscreenIcon exit={fullscreen} />
          </button>
        </div>
      </div>



      {/* ── Content area ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* File tree sidebar (only in files mode) */}
        {viewMode === "files" && (
          <div
            className="shrink-0 overflow-y-auto border-r"
            style={{ width: "180px", background: "#0f0f0f", borderColor: "#252525" }}
          >
            <FileTree
              allFiles={allFilesForTree}
              selectedPath={selectedFilePath}
              streamingPaths={streamingPaths}
              onSelect={(path) => {
                setSelectedFilePath(path);
                if (getFileCategory(path) === "page") {
                  setActivePageName(path);
                }
              }}
            />
          </div>
        )}

        {/* Main content */}
        <div
          className="flex-1 overflow-hidden relative flex items-start justify-center"
          style={{ background: viewMode === "preview" ? "#e5e7eb" : "#0d0d0d" }}
        >
          {!activeContent && !hasAnyStreaming ? (
            <ZaiLoading thinking={isThinking} />
          ) : hasAnyStreaming && !activeContent ? (
            <ZaiLoading label="project files" thinking={isThinking} />
          ) : activeContent?.isPartial ? (
            <ZaiLoading label={activeTab ? getDisplayName(activeTab) : "page"} />
          ) : viewMode === "preview" ? (
            <div
              className="h-full shrink-0 overflow-hidden shadow-2xl fade-in"
              style={{
                width: viewportWidth,
                maxWidth: "100%",
                transition: "width 0.3s ease",
              }}
            >
              <iframe
                key={`${activeTab}-${iframeKey}`}
                srcDoc={activeContent?.html ?? ""}
                sandbox="allow-scripts allow-same-origin"
                className="w-full h-full border-0"
                style={{ background: "#fff", display: "block" }}
                title={activeTab ?? "Preview"}
              />
            </div>
          ) : (
            <div className="w-full h-full overflow-auto">
              <SyntaxHighlighter
                language={activeContent?.lang ?? "html"}
                style={atomDark}
                showLineNumbers
                customStyle={{ margin: 0, borderRadius: 0, background: "#0d0d0d", fontSize: "0.78rem", height: "100%", minHeight: "100%" }}
                lineNumberStyle={{ color: "#3a3a3a", minWidth: "2.5em" }}
              >
                {activeContent?.html ?? ""}
              </SyntaxHighlighter>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
