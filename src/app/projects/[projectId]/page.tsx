"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getProjectPages, getProjectFiles, type ProjectPage, type ProjectFile } from "@/lib/db";
import { useChat, PersistConfig, type TokenUsageSnapshot } from "@/hooks/useChat";
import ChatPanel from "@/components/ChatPanel";
import ProjectPreview from "@/components/ProjectPreview";

const MIN_CHAT_PCT = 20;
const MAX_CHAT_PCT = 80;
const DEFAULT_CHAT_PCT = 45;

function ChatWorkspace({
  persist,
  projectName,
  pages,
  files,
  pagesLoading,
  onBack,
}: {
  persist: PersistConfig;
  projectName: string;
  pages: ProjectPage[];
  files: ProjectFile[];
  pagesLoading: boolean;
  onBack: () => void;
}) {
  const { messages, isStreaming, isLoading, lastUsage, sendMessage, stopStreaming, clearMessages, deletePages } =
    useChat(persist);
  const [chatPct, setChatPct] = useState(DEFAULT_CHAT_PCT);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
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

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: "#0f0f0f" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "#d97706 transparent #d97706 transparent" }} />
          <span className="text-xs" style={{ color: "#6b7280" }}>Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-1 h-full overflow-hidden"
      style={{
        cursor: isDragging ? "col-resize" : "default",
        userSelect: isDragging ? "none" : "auto",
      }}
    >
      {/* Chat panel */}
      <div
        className="flex flex-col h-full"
        style={{
          width: previewFullscreen ? "0%" : `${chatPct}%`,
          overflow: "hidden",
          transition: previewFullscreen ? "width 0.25s ease" : undefined,
        }}
      >
        <ChatPanel
          messages={messages}
          isStreaming={isStreaming}
          lastUsage={lastUsage}
          onSend={sendMessage}
          onStop={stopStreaming}
          onClear={clearMessages}
          onDeletePages={deletePages}
          hideNewChat
          projectName={projectName}
          onBack={onBack}
        />
      </div>

      {/* Drag handle */}
      {!previewFullscreen && (
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
          onMouseEnter={(e) => { if (!isDragging) e.currentTarget.style.background = "#3a3a3a"; }}
          onMouseLeave={(e) => { if (!isDragging) e.currentTarget.style.background = "#2a2a2a"; }}
        />
      )}

      {/* Project preview panel */}
      <div
        className="flex flex-col h-full"
        style={{
          width: previewFullscreen ? "100%" : `${100 - chatPct}%`,
          transition: previewFullscreen ? "width 0.25s ease" : undefined,
        }}
      >
        <ProjectPreview
          pages={pages}
          files={files}
          pagesLoading={pagesLoading}
          messages={messages}
          isStreaming={isStreaming}
          fullscreen={previewFullscreen}
          onToggleFullscreen={() => setPreviewFullscreen((v) => !v)}
        />
      </div>
    </div>
  );
}

// ─── Main project page ────────────────────────────────────────────────────────

export default function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { user } = useAuth();
  const router = useRouter();

  const [projectName, setProjectName] = useState("Project");
  const [pages, setPages] = useState<ProjectPage[]>([]);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);

  useEffect(() => {
    const cached = sessionStorage.getItem(`project_name_${projectId}`);
    if (cached) setProjectName(cached);
  }, [projectId]);

  // Load existing pages + files from DB when user is ready
  useEffect(() => {
    if (!user) return;
    setPagesLoading(true); // show spinner the moment we know the user
    // Run independently so a missing project_files table never blocks pages
    const pagesPromise = getProjectPages(projectId)
      .then(setPages)
      .catch((err) => console.error("[load pages]", err));
    const filesPromise = getProjectFiles(projectId)
      .then(setFiles)
      .catch((err) => console.error("[load files]", err));
    Promise.allSettled([pagesPromise, filesPromise]).finally(() =>
      setPagesLoading(false)
    );
  }, [projectId, user]);

  const handlePagesUpdate = useCallback((updatedPages: ProjectPage[]) => {
    setPages((prev) => {
      const map = new Map(prev.map((p) => [p.page_name, p]));
      updatedPages.forEach((p) => map.set(p.page_name, p));
      return Array.from(map.values());
    });
  }, []);

  const handleFilesUpdate = useCallback((updatedFiles: ProjectFile[]) => {
    setFiles((prev) => {
      const map = new Map(prev.map((f) => [f.file_path, f]));
      updatedFiles.forEach((f) => map.set(f.file_path, f));
      return Array.from(map.values());
    });
  }, []);

  const persistConfig: PersistConfig | undefined = user
    ? {
        projectId,
        userId: user.id,
        pages,
        files,
        onPagesUpdate: handlePagesUpdate,
        onFilesUpdate: handleFilesUpdate,
      }
    : undefined;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#0f0f0f" }}>
      {persistConfig ? (
        <ChatWorkspace
          persist={persistConfig}
          projectName={projectName}
          pages={pages}
          files={files}
          pagesLoading={pagesLoading}
          onBack={() => router.push("/")}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div
            className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: "#d97706 transparent #d97706 transparent" }}
          />
        </div>
      )}
    </div>
  );
}
