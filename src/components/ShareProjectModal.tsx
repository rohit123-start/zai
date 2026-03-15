"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ProjectCollaborator, ProjectInvitation, CollaboratorRole } from "@/lib/db";

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  const initial = (name?.[0] ?? "?").toUpperCase();
  const colors = ["#d97706","#7c3aed","#0891b2","#059669","#dc2626","#be185d","#2563eb"];
  const color = colors[initial.charCodeAt(0) % colors.length];

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
        style={{ border: "1.5px solid #2a2a2a" }}
      />
    );
  }
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
      style={{ background: color, color: "#fff" }}
    >
      {initial}
    </div>
  );
}

// ─── Role pill / dropdown ─────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  owner:  "Owner",
  editor: "Can edit",
  viewer: "Can view",
};

function RoleSelector({
  role,
  onChange,
  disabled,
}: {
  role: CollaboratorRole | "editor" | "viewer";
  onChange?: (r: "editor" | "viewer") => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (disabled || role === "owner") {
    return (
      <span className="text-sm" style={{ color: "#6b7280" }}>
        {ROLE_LABELS[role]}
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="flex items-center gap-1 text-sm rounded-md px-2 py-1 transition-colors"
        style={{ color: "#9ca3af" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "#2a2a2a"; e.currentTarget.style.color = "#e5e5e5"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9ca3af"; }}
      >
        {ROLE_LABELS[role]}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 150ms" }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1 z-20 rounded-lg py-1 min-w-32"
            style={{ background: "#1f1f1f", border: "1px solid #2a2a2a", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
          >
            {(["editor", "viewer"] as const).map((r) => (
              <button
                key={r}
                onClick={(e) => { e.stopPropagation(); onChange?.(r); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors"
                style={{ color: r === role ? "#e5e5e5" : "#9ca3af" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2a2a")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {r === role && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {r !== role && <span className="w-3" />}
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  projectId: string;
  projectName: string;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLButtonElement>;
};

export default function ShareProjectModal({ projectId, projectName, onClose, anchorRef }: Props) {
  const [email, setEmail]         = useState("");
  const [role, setRole]           = useState<"editor" | "viewer">("editor");
  const [sending, setSending]     = useState(false);
  const [loading, setLoading]     = useState(true);
  const [sent, setSent]           = useState<string | null>(null);
  const [errMsg, setErrMsg]       = useState<string | null>(null);
  const [collaborators, setCollabs] = useState<ProjectCollaborator[]>([]);
  const [invitations, setInvites] = useState<ProjectInvitation[]>([]);
  const [showInvited, setShowInvited] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/share`);
      if (res.ok) {
        const d = await res.json();
        setCollabs(d.collaborators ?? []);
        setInvites(d.invitations ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 60); }, []);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setSending(true);
    setErrMsg(null);
    setSent(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
      });
      const d = await res.json();
      if (!res.ok) { setErrMsg(d.error ?? "Failed to send invite"); return; }
      setSent(email.trim().toLowerCase());
      setEmail("");
      await loadData();
      setShowInvited(true);
    } finally {
      setSending(false);
    }
  };

  const handleChangeRole = async (id: string, newRole: "editor" | "viewer") => {
    await fetch(`/api/projects/${projectId}/share/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    setCollabs((prev) => prev.map((c) => (c.id === id ? { ...c, role: newRole } : c)));
  };

  const handleRemoveCollab = async (id: string) => {
    await fetch(`/api/projects/${projectId}/share/${id}`, { method: "DELETE" });
    setCollabs((prev) => prev.filter((c) => c.id !== id));
  };

  const handleCancelInvite = async (id: string) => {
    await fetch(`/api/projects/${projectId}/share/invite/${id}`, { method: "DELETE" });
    setInvites((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <>
      {/* backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* panel */}
      <div
        ref={panelRef}
        className="fixed z-50 rounded-2xl overflow-hidden"
        style={{
          background: "#141414",
          border: "1px solid #2a2a2a",
          boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
          width: "400px",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <h2 className="text-sm font-semibold" style={{ color: "#e5e5e5" }}>
            Share project
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: "#6b7280" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#2a2a2a"; e.currentTarget.style.color = "#e5e5e5"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#6b7280"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Invite input */}
        <div className="px-5 pb-4">
          <div
            className="flex items-center gap-2 rounded-xl overflow-hidden"
            style={{ background: "#1f1f1f", border: `1px solid ${errMsg ? "#ef4444" : "#2a2a2a"}` }}
          >
            <input
              ref={inputRef}
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrMsg(null); setSent(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleInvite(); }}
              placeholder="Add people by email"
              className="flex-1 bg-transparent px-4 py-2.5 text-sm outline-none"
              style={{ color: "#e5e5e5" }}
            />
            {/* role toggle */}
            <div className="flex items-center pr-1">
              <div
                className="flex rounded-lg overflow-hidden"
                style={{ border: "1px solid #333" }}
              >
                {(["editor","viewer"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className="px-2.5 py-1 text-xs transition-colors"
                    style={{
                      background: role === r ? "#2a2a2a" : "transparent",
                      color: role === r ? "#e5e5e5" : "#6b7280",
                    }}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
              <button
                onClick={handleInvite}
                disabled={!email.trim() || sending}
                className="ml-2 mr-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: email.trim() ? "#d97706" : "#2a2a2a",
                  color: email.trim() ? "#0f0f0f" : "#4b5563",
                  cursor: email.trim() ? "pointer" : "not-allowed",
                }}
              >
                {sending ? "…" : "Invite"}
              </button>
            </div>
          </div>

          {errMsg && (
            <p className="text-xs mt-2 px-1" style={{ color: "#f87171" }}>{errMsg}</p>
          )}
          {sent && (
            <p className="text-xs mt-2 px-1" style={{ color: "#10b981" }}>
              Invite sent to {sent}
            </p>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: "1px", background: "#1f1f1f" }} />

        {/* Project access */}
        <div className="px-5 pt-4 pb-1">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#4b5563" }}>
            Project access
          </p>

          {loading ? (
            <div className="flex flex-col gap-3 pb-4">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-full" style={{ background: "#2a2a2a" }} />
                  <div className="flex-1">
                    <div className="h-3 rounded w-32 mb-1.5" style={{ background: "#2a2a2a" }} />
                    <div className="h-2.5 rounded w-24" style={{ background: "#222" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col" style={{ maxHeight: "240px", overflowY: "auto" }}>
              {/* Pending invites row */}
              {invitations.length > 0 && (
                <button
                  onClick={() => setShowInvited((v) => !v)}
                  className="flex items-center gap-3 py-2.5 w-full text-left rounded-lg transition-colors"
                  style={{ color: "#6b7280" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "#1f1f1f", border: "1px dashed #3a3a3a" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                  <span className="flex-1 text-sm">
                    People you invited
                    <span
                      className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full"
                      style={{ background: "#2a2a2a", color: "#9ca3af" }}
                    >
                      {invitations.length}
                    </span>
                  </span>
                  <svg
                    width="14" height="14" viewBox="0 0 12 12" fill="none"
                    style={{ transform: showInvited ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 150ms" }}
                  >
                    <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}

              {/* Pending invites expanded */}
              {showInvited && invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center gap-3 py-2.5 pl-4 rounded-lg group"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                    style={{ background: "#1f1f1f", border: "1px dashed #3a3a3a", color: "#6b7280" }}
                  >
                    {inv.email[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: "#9ca3af" }}>{inv.email}</p>
                    <p className="text-xs" style={{ color: "#4b5563" }}>Invite pending</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: "#6b7280" }}>{ROLE_LABELS[inv.role]}</span>
                    <button
                      onClick={() => handleCancelInvite(inv.id)}
                      className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded transition-all"
                      style={{ color: "#6b7280" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.background = "#2a1a1a"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "#6b7280"; e.currentTarget.style.background = "transparent"; }}
                      title="Cancel invite"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}

              {/* Active collaborators */}
              {collaborators.map((c) => (
                <div key={c.id} className="flex items-center gap-3 py-2.5 rounded-lg group">
                  <Avatar name={c.display_name ?? c.email ?? "?"} avatarUrl={c.avatar_url} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: "#e5e5e5" }}>
                      {c.display_name && c.display_name !== c.email ? c.display_name : c.email}
                      {c.role === "owner" && (
                        <span className="ml-1 text-xs" style={{ color: "#4b5563" }}>(you)</span>
                      )}
                    </p>
                    {c.display_name && c.display_name !== c.email && (
                      <p className="text-xs truncate" style={{ color: "#4b5563" }}>{c.email}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <RoleSelector
                      role={c.role}
                      disabled={c.role === "owner"}
                      onChange={(r) => handleChangeRole(c.id, r)}
                    />
                    {c.role !== "owner" && (
                      <button
                        onClick={() => handleRemoveCollab(c.id)}
                        className="opacity-0 group-hover:opacity-100 ml-1 w-6 h-6 flex items-center justify-center rounded transition-all"
                        style={{ color: "#6b7280" }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.background = "#2a1a1a"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "#6b7280"; e.currentTarget.style.background = "transparent"; }}
                        title="Remove"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3">
          <p className="text-xs text-center" style={{ color: "#3a3a3a" }}>
            {projectName}
          </p>
        </div>
      </div>
    </>
  );
}
