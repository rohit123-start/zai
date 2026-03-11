"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { useAuth } from "@/components/AuthProvider";
import { getProjects, createProject, deleteProject, Project } from "@/lib/db";
import { createClient } from "@/lib/supabase/client";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ProfileMenu({
  user,
  isAdmin,
  onAdmin,
  onSignOut,
}: {
  user: User;
  isAdmin: boolean;
  onAdmin: () => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const displayName = user.user_metadata?.full_name ?? user.email ?? "User";
  const initial = displayName[0].toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors"
        style={{ border: "1px solid transparent" }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.borderColor = "transparent"; }}
      >
        {user.user_metadata?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.user_metadata.avatar_url}
            alt="Avatar"
            className="w-7 h-7 rounded-full object-cover"
            style={{ border: "1px solid #2a2a2a" }}
          />
        ) : (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: "#2a2a2a", color: "#e5e5e5" }}
          >
            {initial}
          </div>
        )}
        {/* chevron */}
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{ color: "#6b7280", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 150ms" }}
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          {/* dropdown */}
          <div
            className="absolute right-0 mt-2 z-20 rounded-xl py-1 min-w-48"
            style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
          >
            {/* user info */}
            <div className="px-4 py-3" style={{ borderBottom: "1px solid #2a2a2a" }}>
              <p className="text-sm font-medium truncate" style={{ color: "#e5e5e5" }}>{displayName}</p>
              {user.user_metadata?.full_name && (
                <p className="text-xs mt-0.5 truncate" style={{ color: "#6b7280" }}>{user.email}</p>
              )}
            </div>

            {/* admin link */}
            {isAdmin && (
              <button
                onClick={() => { setOpen(false); onAdmin(); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left"
                style={{ color: "#d97706" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#1f1a10")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                </svg>
                Admin Dashboard
              </button>
            )}

            {/* sign out */}
            <button
              onClick={() => { setOpen(false); onSignOut(); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left"
              style={{ color: "#6b7280" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#1f1010"; e.currentTarget.style.color = "#f87171"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#6b7280"; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function CreateProjectModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, description: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      await onCreate(name.trim(), description.trim());
    } catch {
      setError("Failed to create project. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md p-6 rounded-xl"
        style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}
      >
        <h2 className="text-lg font-semibold mb-5" style={{ color: "#e5e5e5" }}>
          New Project
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: "#9ca3af" }}>
              Project name *
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My awesome project"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                background: "#0f0f0f",
                border: "1px solid #2a2a2a",
                color: "#e5e5e5",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#d97706")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
            />
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: "#9ca3af" }}>
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
              style={{
                background: "#0f0f0f",
                border: "1px solid #2a2a2a",
                color: "#e5e5e5",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#d97706")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
            />
          </div>
          {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}
          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ background: "#2a2a2a", color: "#9ca3af" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
              style={{
                background: "#d97706",
                color: "#0f0f0f",
                opacity: !name.trim() || loading ? 0.5 : 1,
              }}
            >
              {loading ? "Creating…" : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  onOpen,
  onDelete,
}: {
  project: Project;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className="group relative flex flex-col gap-3 p-5 rounded-xl cursor-pointer transition-all duration-200"
      style={{
        background: "#1a1a1a",
        border: "1px solid #2a2a2a",
      }}
      onClick={onOpen}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3a3a3a")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
    >
      {/* Icon */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
        style={{ background: "#d97706", color: "#0f0f0f" }}
      >
        {project.name[0].toUpperCase()}
      </div>

      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate" style={{ color: "#e5e5e5" }}>
          {project.name}
        </p>
        {project.description && (
          <p
            className="text-xs mt-1 line-clamp-2"
            style={{ color: "#6b7280" }}
          >
            {project.description}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "#4b5563" }}>
          {formatDate(project.created_at)}
        </span>
        <div className="flex items-center gap-1">
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: "#0f0f0f", color: "#6b7280", border: "1px solid #2a2a2a" }}
          >
            Active
          </span>
        </div>
      </div>

      {/* Context menu button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu((v) => !v);
        }}
        className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: "#6b7280" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#e5e5e5")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {showMenu && (
        <div
          className="absolute top-10 right-3 z-10 py-1 rounded-lg shadow-lg"
          style={{ background: "#1f1f1f", border: "1px solid #2a2a2a", minWidth: "120px" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { setShowMenu(false); onOpen(); }}
            className="w-full text-left px-3 py-2 text-xs transition-colors"
            style={{ color: "#9ca3af" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#e5e5e5")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#9ca3af")}
          >
            Open
          </button>
          <button
            onClick={() => { setShowMenu(false); onDelete(); }}
            className="w-full text-left px-3 py-2 text-xs transition-colors"
            style={{ color: "#f87171" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#2a1a1a")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadProjects = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getProjects(user.id);
      setProjects(data);
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("user_profiles")
      .select("role")
      .eq("user_id", user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error("[admin check] user_profiles query failed:", error.message);
          return;
        }
        setIsAdmin(data?.role === "admin");
      });
  }, [user]);

  const handleCreate = async (name: string, description: string) => {
    if (!user) return;
    const project = await createProject(user.id, name, description);
    setShowCreate(false);
    sessionStorage.setItem(`project_name_${project.id}`, project.name);
    router.push(`/projects/${project.id}`);
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm("Delete this project and all its chats?")) return;
    try {
      await deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      console.error("Failed to delete project:", err);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#0f0f0f" }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: "#1f1f1f" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
            style={{ background: "#d97706", color: "#0f0f0f" }}
          >
            Z
          </div>
          <span className="text-sm font-semibold" style={{ color: "#e5e5e5" }}>
            Zai
          </span>
        </div>

        {user && (
          <ProfileMenu
            user={user}
            isAdmin={isAdmin}
            onAdmin={() => router.push("/admin")}
            onSignOut={signOut}
          />
        )}
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#e5e5e5" }}>
              Projects
            </h1>
            <p className="text-sm mt-1" style={{ color: "#6b7280" }}>
              Each project has its own chat history and artifacts
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{ background: "#d97706", color: "#0f0f0f" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Project
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 rounded-xl animate-pulse"
                style={{ background: "#1a1a1a" }}
              />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center"
              style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: "#e5e5e5" }}>
                No projects yet
              </p>
              <p className="text-xs mt-1" style={{ color: "#6b7280" }}>
                Create your first project to start chatting
              </p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-2 px-5 py-2.5 rounded-lg text-sm font-medium"
              style={{ background: "#d97706", color: "#0f0f0f" }}
            >
              Create Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={() => {
                sessionStorage.setItem(`project_name_${project.id}`, project.name);
                router.push(`/projects/${project.id}`);
              }}
                onDelete={() => handleDelete(project.id)}
              />
            ))}
          </div>
        )}
      </main>

      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
