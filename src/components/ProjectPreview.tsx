"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { type ProjectPage, type ProjectFile } from "@/lib/db";
import { type Message } from "@/hooks/useChat";
import { useArtifacts } from "@/hooks/useArtifacts";
import {
  parseFilesFromText,
  isMultiFileResponse,
  getFileCategory,
  getDisplayName,
  type ParsedFile,
} from "@/utils/parseFiles";
import { buildFileMap, stitchPage, stitchLegacyPage, fileLanguage, resolveNavigationTarget } from "@/utils/stitcher";

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = "preview" | "code" | "files";
type ViewportSize = "mobile" | "tablet" | "desktop";

type Props = {
  pages: ProjectPage[];
  files: ProjectFile[];
  pagesLoading: boolean;
  messages: Message[];
  isStreaming: boolean;
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

// ─── Shimmer skeleton ─────────────────────────────────────────────────────────

function ShimmerSkeleton({ label }: { label: string }) {
  return (
    <div className="w-full h-full relative overflow-hidden flex flex-col items-center justify-center gap-5" style={{ background: "#111" }}>
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black"
        style={{ background: "rgba(217,119,6,0.12)", border: "1px solid rgba(217,119,6,0.25)", color: "#d97706", animation: "zaiPulse 2s ease-in-out infinite" }}
      >Z</div>
      <div className="text-center">
        <p className="text-sm font-semibold" style={{ color: "#e5e5e5" }}>
          Building <span style={{ color: "#d97706" }}>{label}</span>
        </p>
        <p className="text-xs mt-1" style={{ color: "#6b7280" }}>Zai is writing files…</p>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: "#d97706", opacity: 0.7, animation: `typingBounce 1.2s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }} />
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
          <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: "#d97706 transparent #d97706 transparent" }} />
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProjectPreview({
  pages,
  files,
  pagesLoading,
  messages,
  isStreaming,
  fullscreen,
  onToggleFullscreen,
}: Props) {
  const [activePageName, setActivePageName] = useState<string | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [viewport, setViewport] = useState<ViewportSize>("desktop");
  const [copied, setCopied] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  // ── Streaming artifacts (live during stream) ───────────────────────────────
  const streamingArtifacts = useArtifacts(messages);

  // Detect if current stream is using multi-file format
  const lastAssistantContent = messages.findLast?.((m) => m.role === "assistant")?.content ?? "";
  const streamIsMultiFile = isStreaming && isMultiFileResponse(lastAssistantContent);

  // Parse streaming files (for live preview during stream)
  const streamingFiles: ParsedFile[] = useMemo(() => {
    if (!streamIsMultiFile) return [];
    return parseFilesFromText(lastAssistantContent, isStreaming);
  }, [lastAssistantContent, streamIsMultiFile, isStreaming]);

  const streamingFileMap = new Map(streamingFiles.map((f) => [f.path, f]));
  const streamingPaths = new Set(streamingFiles.map((f) => f.path));

  // ── Determine pages to show ────────────────────────────────────────────────

  // Multi-file mode: get page paths from project_files
  const dbFilePaths = files.map((f) => f.file_path);
  const dbPagePaths = dbFilePaths.filter((p) => p.startsWith("pages/") && p.endsWith(".html"));

  // Legacy mode: page names from project_pages
  const dbPageNames = pages.map((p) => p.page_name);

  // Streaming page paths (for multi-file stream)
  const streamingPagePaths = [...streamingPaths].filter((p) => p.startsWith("pages/") && p.endsWith(".html"));
  const newStreamingPagePaths = streamingPagePaths.filter((p) => !dbPagePaths.includes(p));

  // Streaming legacy pages (html:PageName format)
  const streamingLegacyMap = new Map(
    streamingArtifacts
      .filter((a) => a.language === "html" && a.pageName && !streamIsMultiFile)
      .map((a) => [a.pageName!, a])
  );
  const unnamedLegacyArtifact = !streamIsMultiFile
    ? streamingArtifacts.find((a) => a.language === "html" && !a.pageName)
    : undefined;

  // Combined list of tabs (either file paths or page names)
  const isFileMode = dbFilePaths.length > 0 || streamIsMultiFile;
  const allPageTabs: string[] = isFileMode
    ? [
        ...dbPagePaths,
        ...newStreamingPagePaths,
      ]
    : [
        ...dbPageNames,
        ...[...streamingLegacyMap.keys()].filter((n) => !dbPageNames.includes(n)),
        ...(unnamedLegacyArtifact && dbPageNames.length === 0 && streamingLegacyMap.size === 0 ? ["Home"] : []),
      ];

  const hasAnyStreaming = isStreaming && (streamIsMultiFile || streamingLegacyMap.size > 0 || !!unnamedLegacyArtifact);

  // Resolve active page tab
  const activeTab =
    activePageName && allPageTabs.includes(activePageName)
      ? activePageName
      : allPageTabs[0] ?? null;

  // ── Resolve content for rendering ─────────────────────────────────────────

  function resolveContent(): { html: string; isPartial: boolean; lang: string } | null {
    if (viewMode === "files" && selectedFilePath) {
      // Show raw file content
      const streamFile = streamingFileMap.get(selectedFilePath);
      if (streamFile) return { html: streamFile.content, isPartial: !!streamFile.partial, lang: fileLanguage(selectedFilePath) };
      const dbFile = files.find((f) => f.file_path === selectedFilePath);
      if (dbFile) return { html: dbFile.content, isPartial: false, lang: fileLanguage(selectedFilePath) };
      return null;
    }

    if (!activeTab) return null;

    if (isFileMode) {
      // ── Multi-file mode ─────────────────────────────────────────────────
      if (viewMode === "code") {
        // Show raw page HTML
        const streaming = streamingFileMap.get(activeTab);
        if (streaming) return { html: streaming.content, isPartial: !!streaming.partial, lang: "html" };
        const dbFile = files.find((f) => f.file_path === activeTab);
        if (dbFile) return { html: dbFile.content, isPartial: false, lang: "html" };
        return null;
      }

      // Preview mode: stitch the page
      const allAvailableFiles = [
        ...files,
        ...streamingFiles.map((f) => ({ file_path: f.path, content: f.content })),
      ];
      // Streaming files override DB files
      const mergedMap = buildFileMap([
        ...allAvailableFiles,
        ...streamingFiles.map((f) => ({ file_path: f.path, content: f.content })),
      ]);

      const streamingPage = streamingFileMap.get(activeTab);
      if (streamingPage?.partial) {
        // Still writing this page
        return { html: streamingPage.content, isPartial: true, lang: "html" };
      }

      const stitched = stitchPage(activeTab, mergedMap);
      return stitched ? { html: stitched, isPartial: false, lang: "html" } : null;
    } else {
      // ── Legacy page mode (html:PageName or plain html) ─────────────────
      const streaming = streamingLegacyMap.get(activeTab);
      if (streaming) return {
        html: streaming.partial ? streaming.content : stitchLegacyPage(streaming.content),
        isPartial: !!streaming.partial,
        lang: "html",
      };

      if (unnamedLegacyArtifact && activeTab === "Home" && dbPageNames.length === 0) {
        return {
          html: unnamedLegacyArtifact.partial ? unnamedLegacyArtifact.content : stitchLegacyPage(unnamedLegacyArtifact.content),
          isPartial: !!unnamedLegacyArtifact.partial,
          lang: "html",
        };
      }

      const dbPage = pages.find((p) => p.page_name === activeTab);
      if (dbPage) return { html: stitchLegacyPage(dbPage.html_content), isPartial: false, lang: "html" };
      return null;
    }
  }

  const activeContent = resolveContent();

  // ── Page switch ────────────────────────────────────────────────────────────
  const switchPage = useCallback((name: string) => {
    setActivePageName(name);
  }, []);

  const handleReload = useCallback(() => setIframeKey((k) => k + 1), []);

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
      <div className="flex items-center justify-between px-4 shrink-0" style={{ height: "44px", borderBottom: "1px solid #252525" }}>
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <span className="text-sm font-semibold" style={{ color: "#e5e5e5" }}>Preview</span>
          {totalPageCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "#252525", color: "#9ca3af" }}>
              {totalPageCount} {totalPageCount === 1 ? "page" : "pages"}
            </span>
          )}
          {isFileMode && allFilesForTree.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "#252525", color: "#6b7280" }}>
              {allFilesForTree.length} files
            </span>
          )}
          {hasAnyStreaming && (
            <span className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(217,119,6,0.1)", color: "#d97706", border: "1px solid rgba(217,119,6,0.2)" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#d97706", animation: "streamingGlow 0.8s ease-in-out infinite" }} />
              Building…
            </span>
          )}
        </div>
        <button
          onClick={onToggleFullscreen}
          title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          className="flex items-center justify-center w-7 h-7 rounded transition-all duration-150"
          style={{ color: "#6b7280" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#e5e5e5"; e.currentTarget.style.background = "#252525"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#6b7280"; e.currentTarget.style.background = "transparent"; }}
        >
          <FullscreenIcon exit={fullscreen} />
        </button>
      </div>

      {/* ── Page tabs ── */}
      {allPageTabs.length > 0 && (
        <div className="flex items-center gap-0.5 px-3 shrink-0 overflow-x-auto" style={{ height: "38px", borderBottom: "1px solid #252525", background: "#111" }}>
          {allPageTabs.map((tab) => {
            const isActive = tab === activeTab;
            const label = isFileMode ? getDisplayName(tab) : tab;
            const isTabStreaming = streamingPaths.has(tab) && streamingFileMap.get(tab)?.partial;
            return (
              <button
                key={tab}
                onClick={() => { switchPage(tab); if (viewMode === "files") setViewMode("preview"); }}
                className="flex items-center gap-1.5 px-3 text-xs font-medium whitespace-nowrap transition-all duration-150 shrink-0"
                style={{
                  height: "38px",
                  color: isActive ? "#e5e5e5" : "#6b7280",
                  borderBottom: isActive ? "2px solid #d97706" : "2px solid transparent",
                  background: isActive ? "rgba(217,119,6,0.06)" : "transparent",
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = "#d1d5db"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = "#6b7280"; }}
              >
                <FileIcon path={isFileMode ? tab : `pages/${tab}.html`} />
                <span>{label}</span>
                {isTabStreaming && (
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#d97706", animation: "streamingGlow 0.8s ease-in-out infinite" }} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-3 shrink-0" style={{ height: "36px", borderBottom: "1px solid #252525", background: "#111" }}>
        {/* View mode */}
        <div className="flex items-center gap-0.5">
          {(["preview", "code", ...(isFileMode ? ["files"] : [])] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className="px-2.5 py-1 text-xs font-medium capitalize rounded transition-all duration-150"
              style={{
                color: viewMode === mode ? "#e5e5e5" : "#6b7280",
                background: viewMode === mode ? "#252525" : "transparent",
              }}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1">
          {viewMode === "preview" && (
            <>
              {/* Viewport toggle */}
              <div className="flex items-center rounded overflow-hidden" style={{ border: "1px solid #2a2a2a" }}>
                {VIEWPORTS.map((vp) => (
                  <button
                    key={vp.id}
                    onClick={() => setViewport(vp.id)}
                    title={`${vp.label} (${vp.width})`}
                    className="flex items-center justify-center px-2 py-1 transition-all duration-150"
                    style={{
                      color: viewport === vp.id ? "#d97706" : "#6b7280",
                      background: viewport === vp.id ? "rgba(217,119,6,0.1)" : "transparent",
                      borderRight: vp.id !== "desktop" ? "1px solid #2a2a2a" : "none",
                      height: "24px",
                      gap: "3px",
                    }}
                  >
                    {vp.icon}
                  </button>
                ))}
              </div>
              {/* Reload */}
              <button
                onClick={handleReload}
                title="Reload"
                className="flex items-center justify-center w-6 h-6 rounded transition-all duration-150"
                style={{ color: "#6b7280" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#e5e5e5"; e.currentTarget.style.background = "#252525"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#6b7280"; e.currentTarget.style.background = "transparent"; }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              </button>
            </>
          )}

          {/* Copy */}
          <button
            onClick={handleCopy}
            disabled={!activeContent}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-all duration-150"
            style={{ background: copied ? "#166534" : "#252525", color: copied ? "#86efac" : "#9ca3af" }}
          >
            {copied ? "Copied!" : "Copy"}
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
            <div className="flex items-center justify-center w-full h-full">
              <div className="flex flex-col items-center gap-3">
                <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: "#d97706 transparent #d97706 transparent" }} />
                <span className="text-xs" style={{ color: "#6b7280" }}>Loading…</span>
              </div>
            </div>
          ) : hasAnyStreaming && !activeContent ? (
            <ShimmerSkeleton label="project files" />
          ) : activeContent?.isPartial ? (
            <ShimmerSkeleton label={activeTab ? getDisplayName(activeTab) : "page"} />
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
