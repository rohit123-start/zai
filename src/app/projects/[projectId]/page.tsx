"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  getChatSessions,
  createChatSession,
  deleteChatSession,
  ChatSession,
} from "@/lib/db";
import { useChat, PersistConfig } from "@/hooks/useChat";
import ChatPanel from "@/components/ChatPanel";
import ArtifactsPanel from "@/components/ArtifactsPanel";

const MIN_CHAT_PCT = 20;
const MAX_CHAT_PCT = 80;
const DEFAULT_CHAT_PCT = 60;

// ─── Split Chat+Artifacts workspace (remounts when session changes via key) ───

function ChatWorkspace({
  persist,
  projectName,
  onBack,
}: {
  persist: PersistConfig;
  projectName: string;
  onBack: () => void;
}) {
  const { messages, isStreaming, isLoading, sendMessage, stopStreaming, clearMessages } =
    useChat(persist);
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

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: "#0f0f0f" }}>
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: "#d97706 transparent #d97706 transparent" }}
          />
          <span className="text-xs" style={{ color: "#6b7280" }}>Loading messages…</span>
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
      {/* Chat */}
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
          hideNewChat
          projectName={projectName}
          onBack={onBack}
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

      {/* Artifacts */}
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

// ─── Session sidebar item ─────────────────────────────────────────────────────

function SessionItem({
  session,
  active,
  onSelect,
  onDelete,
}: {
  session: ChatSession;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className="group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors"
      style={{
        background: active ? "#2a2a2a" : "transparent",
        color: active ? "#e5e5e5" : "#9ca3af",
      }}
      onClick={onSelect}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "#1f1f1f";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 opacity-60"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <span className="text-xs truncate flex-1">{session.title}</span>

      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu((v) => !v);
        }}
        className="shrink-0 w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: "#6b7280" }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {showMenu && (
        <div
          className="absolute right-0 top-7 z-20 py-1 rounded-lg shadow-xl"
          style={{
            background: "#1f1f1f",
            border: "1px solid #2a2a2a",
            minWidth: "110px",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setShowMenu(false);
              onDelete();
            }}
            className="w-full text-left px-3 py-2 text-xs"
            style={{ color: "#f87171" }}
          >
            Delete
          </button>
        </div>
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

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("Project");
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Load sessions
  useEffect(() => {
    if (!user) return;

    // Load project name from sessions (we'll just show the projectId short form for now)
    // and load sessions
    getChatSessions(projectId)
      .then(async (data) => {
        if (data.length === 0) {
          // Auto-create first session
          const newSession = await createChatSession(projectId, user.id, "New Chat");
          setSessions([newSession]);
          setActiveSessionId(newSession.id);
        } else {
          setSessions(data);
          setActiveSessionId(data[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingSessions(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, user?.id]);

  // Load project name from localStorage cache or from URL
  useEffect(() => {
    const cached = sessionStorage.getItem(`project_name_${projectId}`);
    if (cached) setProjectName(cached);
  }, [projectId]);

  const handleNewChat = async () => {
    if (!user) return;
    try {
      const session = await createChatSession(projectId, user.id, "New Chat");
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(session.id);
    } catch (err) {
      console.error("Failed to create chat session:", err);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm("Delete this chat?")) return;
    try {
      await deleteChatSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        const remaining = sessions.filter((s) => s.id !== sessionId);
        if (remaining.length > 0) {
          setActiveSessionId(remaining[0].id);
        } else if (user) {
          // Create a fresh session
          const newSession = await createChatSession(projectId, user.id, "New Chat");
          setSessions([newSession]);
          setActiveSessionId(newSession.id);
        }
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  const handleTitleUpdate = useCallback(
    (sessionId: string) => (title: string) => {
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title } : s))
      );
    },
    []
  );

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  const persistConfig: PersistConfig | undefined =
    activeSession && user
      ? {
          sessionId: activeSession.id,
          projectId,
          userId: user.id,
          onTitleUpdate: handleTitleUpdate(activeSession.id),
        }
      : undefined;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#0f0f0f" }}>
      {/* Sidebar */}
      {sidebarOpen && (
        <div
          className="flex flex-col h-full shrink-0"
          style={{
            width: "220px",
            background: "#111111",
            borderRight: "1px solid #1f1f1f",
          }}
        >
          {/* Sidebar header */}
          <div
            className="flex items-center justify-between px-3 py-3 border-b shrink-0"
            style={{ borderColor: "#1f1f1f" }}
          >
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-1.5 text-xs transition-colors"
              style={{ color: "#6b7280" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#e5e5e5")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Projects
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="w-5 h-5 flex items-center justify-center rounded transition-colors"
              style={{ color: "#4b5563" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#9ca3af")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#4b5563")}
              title="Collapse sidebar"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
          </div>

          {/* Project name */}
          <div className="px-3 py-3 shrink-0">
            <p className="text-xs font-semibold truncate" style={{ color: "#e5e5e5" }}>
              {projectName}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#4b5563" }}>
              {sessions.length} chat{sessions.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* New Chat button */}
          <div className="px-2 pb-2 shrink-0">
            <button
              onClick={handleNewChat}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors"
              style={{
                background: "#1a1a1a",
                color: "#9ca3af",
                border: "1px solid #2a2a2a",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#e5e5e5";
                e.currentTarget.style.borderColor = "#3a3a3a";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#9ca3af";
                e.currentTarget.style.borderColor = "#2a2a2a";
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Chat
            </button>
          </div>

          {/* Sessions list */}
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            {loadingSessions ? (
              <div className="space-y-1 mt-1">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-8 rounded-lg animate-pulse"
                    style={{ background: "#1a1a1a" }}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-0.5">
                {sessions.map((session) => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    active={session.id === activeSessionId}
                    onSelect={() => setActiveSessionId(session.id)}
                    onDelete={() => handleDeleteSession(session.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Collapsed sidebar toggle */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="absolute left-2 top-3 z-20 w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
          style={{
            background: "#1a1a1a",
            border: "1px solid #2a2a2a",
            color: "#6b7280",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#e5e5e5")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}
          title="Expand sidebar"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>
      )}

      {/* Main workspace — key forces full remount on session switch */}
      {persistConfig ? (
        <ChatWorkspace
          key={persistConfig.sessionId}
          persist={persistConfig}
          projectName={projectName}
          onBack={() => router.push("/")}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center" style={{ background: "#0f0f0f" }}>
          <div
            className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: "#d97706 transparent #d97706 transparent" }}
          />
        </div>
      )}
    </div>
  );
}
