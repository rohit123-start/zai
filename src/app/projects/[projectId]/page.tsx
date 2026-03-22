"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getProjectFiles, type ProjectFile } from "@/lib/db";
import { createClient } from "@/lib/supabase/client";
import { useChat, PersistConfig, type TokenUsageSnapshot } from "@/hooks/useChat";
import ChatPanel from "@/components/ChatPanel";
import ProjectPreview from "@/components/ProjectPreview";
import ShareProjectModal from "@/components/ShareProjectModal";

const MIN_CHAT_PCT = 20;
const MAX_CHAT_PCT = 80;
const DEFAULT_CHAT_PCT = 45;

function ChatWorkspace({
  persist,
  projectName,
  files,
  pagesLoading,
  onBack,
}: {
  persist: PersistConfig;
  projectName: string;
  files: ProjectFile[];
  pagesLoading: boolean;
  onBack: () => void;
}) {
  const { messages, isStreaming, isLoading, lastUsage, sendMessage, stopStreaming, clearMessages, deletePages } =
    useChat(persist);
  const [chatPct, setChatPct] = useState(DEFAULT_CHAT_PCT);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showShare, setShowShare] = useState(false);
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
      <div className="flex-1 flex items-center justify-center" style={{ background: "#000" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "#06b6d4 transparent #06b6d4 transparent" }} />
          <span className="text-xs" style={{ color: "#71717a", fontFamily: "var(--font-dm-mono)" }}>Loading…</span>
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
          onShare={() => setShowShare(true)}
        />
      </div>

      {/* Drag handle */}
      {!previewFullscreen && (
        <div
          onMouseDown={handleMouseDown}
          className="flex items-center justify-center h-full shrink-0"
          style={{
            width: "4px",
            cursor: "col-resize",
            background: isDragging ? "#06b6d4" : "rgba(255,255,255,0.06)",
            transition: "background 0.15s",
            zIndex: 10,
          }}
          onMouseEnter={(e) => { if (!isDragging) e.currentTarget.style.background = "rgba(6,182,212,0.3)"; }}
          onMouseLeave={(e) => { if (!isDragging) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
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
          files={files}
          pagesLoading={pagesLoading}
          messages={messages}
          isStreaming={isStreaming}
          fullscreen={previewFullscreen}
          onToggleFullscreen={() => setPreviewFullscreen((v) => !v)}
        />
      </div>

      {showShare && (
        <ShareProjectModal
          projectId={persist.projectId}
          projectName={projectName}
          onClose={() => setShowShare(false)}
        />
      )}
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
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);

  // Load project name — try sessionStorage first, then DB (needed for collaborators)
  useEffect(() => {
    const cached = sessionStorage.getItem(`project_name_${projectId}`);
    if (cached) {
      setProjectName(cached);
      return;
    }
    if (!user) return;
    const supabase = createClient();
    (async () => {
      try {
        const { data } = await supabase
          .from("projects")
          .select("name")
          .eq("id", projectId)
          .single();
        if (data?.name) {
          setProjectName(data.name);
          sessionStorage.setItem(`project_name_${projectId}`, data.name);
        }
      } catch {
        // non-critical — project name falls back to "Project"
      }
    })();
  }, [projectId, user]);

  // Load files from DB when user is ready
  useEffect(() => {
    if (!user) return;
    setPagesLoading(true);
    getProjectFiles(projectId)
      .then(setFiles)
      .catch((err) => console.error("[load files]", err))
      .finally(() => setPagesLoading(false));
  }, [projectId, user]);

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
        files,
        onFilesUpdate: handleFilesUpdate,
      }
    : undefined;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#000" }}>
      {persistConfig ? (
        <ChatWorkspace
          persist={persistConfig}
          projectName={projectName}
          files={files}
          pagesLoading={pagesLoading}
          onBack={() => router.push("/")}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div
            className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: "#06b6d4 transparent #06b6d4 transparent" }}
          />
        </div>
      )}
    </div>
  );
}
