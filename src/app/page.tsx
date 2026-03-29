"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { useAuth } from "@/components/AuthProvider";
import { getProjects, deleteProject, Project } from "@/lib/db";
import ShareProjectModal from "@/components/ShareProjectModal";

function formatTimeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const ACCENT_COLORS = [
  "#06b6d4", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#ef4444", "#22d3ee",
];

function getAccentForProject(id: string) {
  let hash = 0;
  for (const ch of id) hash = ((hash << 5) - hash) + ch.charCodeAt(0);
  return ACCENT_COLORS[Math.abs(hash) % ACCENT_COLORS.length];
}

function ProfileDropdown({ user, onSignOut, onClose }: { user: User; onSignOut: () => void; onClose: () => void }) {
  const displayName = user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User";
  const initial = displayName[0].toUpperCase();

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 rounded-xl py-1.5"
        style={{
          top: 62, right: 16,
          background: "#0f0f0f",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
          minWidth: 200,
        }}
      >
        {/* user info */}
        <div className="flex items-center gap-2.5 px-3 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#06b6d4,#0891b2)", color: "#000" }}>
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "#fff", fontFamily: "var(--font-space-grotesk)" }}>{displayName}</p>
            <p className="text-xs truncate" style={{ color: "#3f3f46" }}>{user.email}</p>
          </div>
        </div>
        <div style={{ padding: "4px" }}>
          <button
            onClick={() => { onClose(); onSignOut(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors text-left"
            style={{ color: "rgba(239,68,68,0.7)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; e.currentTarget.style.color = "#ef4444"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(239,68,68,0.7)"; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}

function ProjectCard({
  project,
  onOpen,
  onDelete,
  onShare,
}: {
  project: Project;
  onOpen: () => void;
  onDelete: () => void;
  onShare: () => void;
}) {
  const accent = getAccentForProject(project.id);
  const initial = project.name[0].toUpperCase();

  return (
    <div
      className="group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200"
      style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}
      onClick={onOpen}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.5)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
    >
      {/* Thumbnail */}
      <div className="relative overflow-hidden" style={{ height: 140, background: "#050505" }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)",
          backgroundSize: "20px 20px",
        }} />
        {/* Phone mock */}
        <div style={{
          position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)",
          width: 64, background: "#050505",
          border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: 12,
          overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
        }}>
          <div style={{ height: 12, background: "#050505", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 4px" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: accent, opacity: 0.7 }} />
          </div>
          <div style={{ background: "#050505", padding: "3px 4px" }}>
            <div style={{ height: 3, background: accent, width: "55%", borderRadius: 1, marginBottom: 2 }} />
            <div style={{ height: 3, background: `${accent}4d`, width: "40%", borderRadius: 1, marginBottom: 3 }} />
            <div style={{ height: 22, background: `${accent}14`, border: `1px solid ${accent}33`, borderRadius: 4, marginBottom: 3 }} />
            <div style={{ height: 2, background: "rgba(255,255,255,0.08)", width: "80%", borderRadius: 1, marginBottom: 2 }} />
            <div style={{ height: 2, background: "rgba(255,255,255,0.05)", width: "60%", borderRadius: 1, marginBottom: 3 }} />
            <div style={{ height: 8, width: 36, borderRadius: 2, background: `${accent}66`, margin: "4px auto 0" }} />
          </div>
        </div>
        {/* Glow */}
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 70% 50% at 50% 100%, ${accent}1a 0%, transparent 70%)`, pointerEvents: "none" }} />
        {/* Hover actions */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => { e.stopPropagation(); onShare(); }}
            className="flex items-center justify-center rounded-lg transition-all"
            style={{ width: 28, height: 28, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)", color: "#71717a" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#71717a"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
            title="Share"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${project.name}"?`)) onDelete(); }}
            className="flex items-center justify-center rounded-lg transition-all"
            style={{ width: 28, height: 28, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)", color: "#71717a" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#71717a"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
            title="Delete"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "12px 14px 14px" }}>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="font-semibold text-sm truncate" style={{ color: "#fff", fontFamily: "var(--font-space-grotesk)", letterSpacing: "-0.2px" }}>
            {project.name}
          </p>
          <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)", fontFamily: "var(--font-dm-mono)" }}>
            Active
          </span>
        </div>
        <div className="flex items-center gap-1.5" style={{ fontFamily: "var(--font-dm-mono)", fontSize: 10, color: "#3f3f46" }}>
          <span>{formatTimeAgo(project.created_at)}</span>
          {project.industry && (
            <>
              <span style={{ width: 2, height: 2, borderRadius: "50%", background: "#3f3f46", display: "inline-block" }} />
              <span>{project.industry}</span>
            </>
          )}
        </div>
        {/* Platform tags */}
        {project.platform && project.platform.length > 0 && (
          <div className="flex gap-1 mt-2 flex-wrap">
            {project.platform.slice(0, 3).map((p: string) => (
              <span key={p} className="text-xs px-1.5 py-0.5 rounded" style={{
                background: p === "iOS" ? "rgba(6,182,212,0.05)" : p === "Android" ? "rgba(16,185,129,0.05)" : "rgba(139,92,246,0.05)",
                color: p === "iOS" ? "rgba(6,182,212,0.7)" : p === "Android" ? "rgba(16,185,129,0.7)" : "rgba(139,92,246,0.7)",
                border: `1px solid ${p === "iOS" ? "rgba(6,182,212,0.15)" : p === "Android" ? "rgba(16,185,129,0.15)" : "rgba(139,92,246,0.15)"}`,
                fontFamily: "var(--font-dm-mono)", fontSize: 9, letterSpacing: "0.2px",
              }}>
                {p}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [shareProject, setShareProject] = useState<Project | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState<"projects" | "shared" | "archive">("projects");

  const displayName = user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "User";
  const initial = displayName[0]?.toUpperCase() ?? "U";

  const loadProjects = useCallback(async () => {
    if (!user) return;
    setLoadError(null);
    try {
      const data = await getProjects(user.id);
      setProjects(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? String(err);
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleDelete = async (projectId: string) => {
    try {
      await deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      console.error("Failed to delete project:", err);
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const NavItem = ({ icon, label, badge, section }: { icon: React.ReactNode; label: string; badge?: string | number; section: "projects" | "shared" | "archive" }) => (
    <button
      onClick={() => setActiveSection(section)}
      className="flex items-center gap-2.5 w-full rounded-lg transition-all relative text-left"
      style={{
        padding: "8px 12px",
        background: activeSection === section ? "rgba(6,182,212,0.1)" : "transparent",
        color: activeSection === section ? "#fff" : "#71717a",
      }}
      onMouseEnter={(e) => { if (activeSection !== section) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
      onMouseLeave={(e) => { if (activeSection !== section) e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: activeSection === section ? "#06b6d4" : "#71717a" }}>{icon}</span>
      {!sidebarCollapsed && <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{label}</span>}
      {!sidebarCollapsed && badge !== undefined && (
        <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: 9, fontWeight: 500, background: "rgba(6,182,212,0.1)", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 4, padding: "2px 6px" }}>
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#000", fontFamily: "var(--font-dm-sans)" }}>

      {/* ── UNIFIED HEADER ── */}
      <div className="fixed top-0 left-0 right-0 z-20 flex items-stretch" style={{ height: 56, background: "rgba(0,0,0,0.95)", borderBottom: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(12px)" }}>
        {/* Brand */}
        <div className="flex items-center gap-2.5 flex-shrink-0 px-4" style={{ width: sidebarCollapsed ? 64 : 240, borderRight: "1px solid rgba(255,255,255,0.06)", transition: "width 0.25s ease" }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: "#06b6d4", color: "#000", fontFamily: "var(--font-space-grotesk)" }}>Z</div>
          {!sidebarCollapsed && (
            <span className="font-bold text-base" style={{ color: "#fff", fontFamily: "var(--font-space-grotesk)", letterSpacing: "-0.3px" }}>zeach</span>
          )}
          <button
            onClick={() => setSidebarCollapsed(v => !v)}
            className="flex items-center justify-center rounded-full transition-all ml-auto flex-shrink-0"
            style={{ width: 20, height: 20, background: "#111", border: "1px solid rgba(255,255,255,0.1)", color: "#71717a" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.background = "#161616"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.background = "#111"; }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              style={{ transform: sidebarCollapsed ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s" }}>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>

        {/* Main header area */}
        <div className="flex items-center gap-3 flex-1 px-5">
          <div className="flex items-baseline gap-2 mr-auto">
            <span className="font-bold text-sm" style={{ color: "#fff", fontFamily: "var(--font-space-grotesk)", letterSpacing: "-0.3px" }}>
              {activeSection === "projects" ? "Projects" : activeSection === "shared" ? "Shared" : "Archive"}
            </span>
            <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: 11, color: "#3f3f46" }}>
              {activeSection === "projects" ? `${projects.length} projects` : ""}
            </span>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 rounded-lg px-3 py-1.5 transition-all"
            style={{ background: "#111", border: "1px solid rgba(255,255,255,0.06)", width: 220 }}
            onFocus={() => {}}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3f3f46" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects…"
              className="bg-transparent border-none outline-none text-sm flex-1"
              style={{ color: "#fff", fontFamily: "var(--font-dm-sans)" }}
            />
          </div>

          {/* New project */}
          <button
            onClick={() => router.push("/projects/new")}
            className="flex items-center gap-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: "#06b6d4", color: "#000", padding: "7px 14px", fontFamily: "var(--font-dm-mono)", letterSpacing: "0.2px" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#22d3ee"; e.currentTarget.style.boxShadow = "0 0 16px rgba(6,182,212,0.3)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#06b6d4"; e.currentTarget.style.boxShadow = "none"; }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New project
          </button>

          {/* Avatar */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(v => !v)}
              className="flex items-center justify-center rounded-lg font-bold text-sm flex-shrink-0"
              style={{ width: 30, height: 30, background: "linear-gradient(135deg,#06b6d4,#0891b2)", color: "#000", fontFamily: "var(--font-space-grotesk)" }}
            >
              {initial}
            </button>
            {profileOpen && user && (
              <ProfileDropdown user={user} onSignOut={signOut} onClose={() => setProfileOpen(false)} />
            )}
          </div>
        </div>
      </div>

      {/* ── SIDEBAR ── */}
      <aside
        className="flex-shrink-0 flex flex-col overflow-hidden"
        style={{
          width: sidebarCollapsed ? 64 : 240,
          background: "#0a0a0a",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          transition: "width 0.25s ease",
          marginTop: 56,
          height: "calc(100vh - 56px)",
        }}
      >
        <nav className="flex-1 p-2.5 flex flex-col gap-0.5 overflow-y-auto">
          {!sidebarCollapsed && (
            <div style={{ fontFamily: "var(--font-dm-mono)", fontSize: 9, letterSpacing: "0.6px", color: "#3f3f46", textTransform: "uppercase", padding: "8px 8px 4px" }}>
              Workspace
            </div>
          )}
          <NavItem
            section="projects"
            label="Projects"
            badge={projects.length}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>}
          />
          <NavItem
            section="shared"
            label="Shared"
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51L8.59 10.49"/></svg>}
          />
          <NavItem
            section="archive"
            label="Archive"
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5" rx="1"/><line x1="10" y1="12" x2="14" y2="12"/></svg>}
          />

          {!sidebarCollapsed && (
            <div style={{ fontFamily: "var(--font-dm-mono)", fontSize: 9, letterSpacing: "0.6px", color: "#3f3f46", textTransform: "uppercase", padding: "12px 8px 4px", marginTop: 4 }}>
              Account
            </div>
          )}
          <button
            className="flex items-center gap-2.5 w-full rounded-lg transition-all text-left"
            style={{ padding: "8px 12px", color: "#71717a" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#71717a"; }}
          >
            <span style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            </span>
            {!sidebarCollapsed && <span style={{ fontSize: 13, fontWeight: 500 }}>Settings</span>}
          </button>
        </nav>

        {/* Credits bar */}
        {!sidebarCollapsed && (
          <div style={{ padding: "14px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: 9, letterSpacing: "0.5px", color: "#3f3f46", textTransform: "uppercase" }}>Credits</span>
              <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: 11, fontWeight: 500, color: "#06b6d4" }}>340 / 500</span>
            </div>
            <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
              <div style={{ height: "100%", width: "68%", background: "linear-gradient(90deg,#06b6d4,#22d3ee)", borderRadius: 2 }} />
            </div>
            <p style={{ fontSize: 11, color: "#3f3f46" }}>160 left · resets in 12d</p>
          </div>
        )}
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 overflow-y-auto" style={{ marginTop: 56, scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.06) transparent" }}>
        <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>

          {loadError && (
            <div className="mb-6 rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
              <span className="font-medium">Could not load projects: </span>{loadError}
            </div>
          )}

          {activeSection === "archive" ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="flex items-center justify-center rounded-2xl" style={{ width: 56, height: 56, border: "1px solid rgba(255,255,255,0.1)", color: "#3f3f46" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5" rx="1"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
              </div>
              <div className="text-center">
                <p className="font-semibold text-lg" style={{ color: "#fff", fontFamily: "var(--font-space-grotesk)" }}>Archive is empty</p>
                <p className="text-sm mt-1" style={{ color: "#71717a" }}>Archived projects will appear here.</p>
              </div>
            </div>
          ) : loading ? (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl animate-pulse" style={{ height: 220, background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }} />
              ))}
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
              {/* New project card */}
              <div
                className="rounded-xl flex flex-col items-center justify-center gap-2.5 cursor-pointer transition-all duration-200 relative overflow-hidden"
                style={{ minHeight: 220, border: "1.5px dashed rgba(6,182,212,0.25)", background: "rgba(6,182,212,0.03)" }}
                onClick={() => router.push("/projects/new")}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(6,182,212,0.5)"; e.currentTarget.style.background = "rgba(6,182,212,0.06)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(6,182,212,0.08)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(6,182,212,0.25)"; e.currentTarget.style.background = "rgba(6,182,212,0.03)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 50% at 50% 100%, rgba(6,182,212,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
                <div className="flex items-center justify-center rounded-xl transition-all" style={{ width: 44, height: 44, border: "1.5px solid rgba(6,182,212,0.4)", background: "rgba(6,182,212,0.08)", color: "#06b6d4" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </div>
                <p className="font-semibold text-sm" style={{ color: "#fff", fontFamily: "var(--font-space-grotesk)", letterSpacing: "-0.2px" }}>New project</p>
                <p style={{ fontFamily: "var(--font-dm-mono)", fontSize: 11, color: "#71717a", letterSpacing: "0.2px" }}>describe → generate</p>
      </div>

              {filteredProjects.length === 0 && searchQuery ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16" style={{ gridColumn: "1/-1" }}>
                  <p className="text-sm" style={{ color: "#71717a" }}>No projects match &quot;{searchQuery}&quot;</p>
                </div>
              ) : (
                filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onOpen={() => {
                      sessionStorage.setItem(`project_name_${project.id}`, project.name);
                      router.push(`/projects/${project.id}`);
                    }}
                    onDelete={() => handleDelete(project.id)}
                    onShare={() => setShareProject(project)}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </main>

      {shareProject && (
        <ShareProjectModal
          projectId={shareProject.id}
          projectName={shareProject.name}
          onClose={() => setShareProject(null)}
        />
      )}
    </div>
  );
}
