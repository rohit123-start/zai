"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

type UserProfile = {
  id: string;
  user_id: string;
  email: string;
  role: "admin" | "member";
  access: "read" | "write";
  created_at: string;
};

type Invitation = {
  id: string;
  email: string;
  role: "admin" | "member";
  access: "read" | "write";
  created_at: string;
};

const ROLE_COLORS = {
  admin:  { bg: "#2a1a3a", color: "#c084fc", border: "#5b21b6" },
  member: { bg: "#1a2a1a", color: "#86efac", border: "#166534" },
};
const ACCESS_COLORS = {
  write: { bg: "#1a2030", color: "#93c5fd", border: "#1d4ed8" },
  read:  { bg: "#1f1f1f", color: "#9ca3af", border: "#374151" },
};

function Badge({ type, value }: { type: "role" | "access"; value: string }) {
  const map = type === "role" ? ROLE_COLORS : ACCESS_COLORS;
  const style = map[value as keyof typeof map] ?? { bg: "#1f1f1f", color: "#9ca3af", border: "#374151" };
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
    >
      {value}
    </span>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

export default function AdminPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [pendingInvites, setPendingInvites] = useState<Invitation[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteAccess, setInviteAccess] = useState<"read" | "write">("read");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // per-row busy state
  const [busyRow, setBusyRow] = useState<string | null>(null);

  // active tab
  const [tab, setTab] = useState<"users" | "invites">("users");

  const fetchData = useCallback(async () => {
    setFetching(true);
    setError(null);
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const json = await res.json();
      setUsers(json.users);
      setPendingInvites(json.pendingInvites);
    } else {
      const json = await res.json();
      setError(json.error ?? "Failed to load");
    }
    setFetching(false);
  }, []);

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [authLoading, fetchData]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteMsg(null);
    const res = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole, access: inviteAccess }),
    });
    const json = await res.json();
    if (res.ok) {
      setInviteMsg({ ok: true, text: `Invite sent to ${inviteEmail}` });
      setInviteEmail("");
      fetchData();
    } else {
      setInviteMsg({ ok: false, text: json.error ?? "Failed to invite" });
    }
    setInviting(false);
  }

  async function updateUser(id: string, patch: { role?: string; access?: string }) {
    setBusyRow(id);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) await fetchData();
    setBusyRow(null);
  }

  async function removeUser(id: string, email: string) {
    if (!confirm(`Remove ${email}? This cannot be undone.`)) return;
    setBusyRow(id);
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    await fetchData();
    setBusyRow(null);
  }

  async function cancelInvite(id: string, email: string) {
    if (!confirm(`Cancel invite for ${email}?`)) return;
    setBusyRow(id);
    await fetch(`/api/admin/invitations/${id}`, { method: "DELETE" });
    await fetchData();
    setBusyRow(null);
  }

  const myProfile = users.find((u) => u.user_id === user?.id);

  if (authLoading) return null;

  // Migration hasn't been run yet
  if (!fetching && error && error.toLowerCase().includes("relation") ) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0f0f0f" }}>
        <div className="max-w-lg w-full mx-4 p-8 rounded-2xl text-center" style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}>
          <div className="text-3xl mb-4">⚠️</div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "#e5e5e5" }}>Database migration required</h2>
          <p className="text-sm mb-6" style={{ color: "#6b7280" }}>
            The <code style={{ color: "#d97706" }}>user_profiles</code> table doesn&apos;t exist yet.
            Run the SQL migration to enable the admin dashboard.
          </p>
          <p className="text-xs px-4 py-3 rounded-lg text-left font-mono" style={{ background: "#111", color: "#9ca3af", border: "1px solid #2a2a2a" }}>
            Supabase Dashboard → SQL Editor → paste &amp; run<br />
            <span style={{ color: "#d97706" }}>supabase/migrations/001_admin.sql</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#0f0f0f", color: "#e5e5e5" }}>
      {/* Top bar */}
      <header
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: "1px solid #1f1f1f" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm"
            style={{ background: "#d97706", color: "#0f0f0f" }}
          >
            Z
          </div>
          <span className="font-semibold text-sm" style={{ color: "#e5e5e5" }}>Admin Dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="text-sm transition-colors"
            style={{ color: "#6b7280" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#e5e5e5")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}
          >
            ← Back to app
          </button>
          <button
            onClick={signOut}
            className="text-sm px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: "#6b7280", border: "1px solid #2a2a2a" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#e5e5e5")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-8">

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total users",     value: users.length },
            { label: "Pending invites", value: pendingInvites.length },
            { label: "Your role",       value: myProfile?.role ?? "—" },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-xl p-4"
              style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}
            >
              <p className="text-xs mb-1" style={{ color: "#6b7280" }}>{label}</p>
              <p className="text-2xl font-bold" style={{ color: "#d97706" }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Invite form */}
        <div className="rounded-xl p-6" style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "#e5e5e5" }}>Invite a user</h2>
          <form onSubmit={handleInvite} className="flex flex-col gap-3">
            <div className="flex gap-3">
              <input
                type="email"
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "#111", color: "#e5e5e5", border: "1px solid #2a2a2a" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#d97706")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}
                className="px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "#111", color: "#e5e5e5", border: "1px solid #2a2a2a" }}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <select
                value={inviteAccess}
                onChange={(e) => setInviteAccess(e.target.value as "read" | "write")}
                className="px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "#111", color: "#e5e5e5", border: "1px solid #2a2a2a" }}
              >
                <option value="read">Read</option>
                <option value="write">Write</option>
              </select>
              <button
                type="submit"
                disabled={inviting || !inviteEmail.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: inviting || !inviteEmail.trim() ? "#3a2a10" : "#d97706",
                  color: inviting || !inviteEmail.trim() ? "#78450a" : "#0f0f0f",
                  cursor: inviting || !inviteEmail.trim() ? "not-allowed" : "pointer",
                }}
              >
                {inviting && <Spinner />}
                {inviting ? "Sending…" : "Send invite"}
              </button>
            </div>
            {inviteMsg && (
              <p
                className="text-xs"
                style={{ color: inviteMsg.ok ? "#4ade80" : "#f87171" }}
              >
                {inviteMsg.text}
              </p>
            )}
          </form>
        </div>

        {/* Tabs */}
        <div>
          <div className="flex gap-1 mb-4" style={{ borderBottom: "1px solid #1f1f1f" }}>
            {(["users", "invites"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-4 py-2 text-sm font-medium capitalize transition-colors"
                style={{
                  color: tab === t ? "#d97706" : "#6b7280",
                  borderBottom: tab === t ? "2px solid #d97706" : "2px solid transparent",
                }}
              >
                {t === "users" ? `Users (${users.length})` : `Pending invites (${pendingInvites.length})`}
              </button>
            ))}
          </div>

          {error && (
            <div className="text-sm px-4 py-3 rounded-lg mb-4" style={{ background: "#2a1a1a", color: "#f87171", border: "1px solid #3a2020" }}>
              {error}
            </div>
          )}

          {fetching ? (
            <div className="flex justify-center py-12" style={{ color: "#4b5563" }}>
              <Spinner />
            </div>
          ) : tab === "users" ? (
            /* ── Users table ── */
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #2a2a2a" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "#1a1a1a", borderBottom: "1px solid #2a2a2a" }}>
                    {["Email", "Role", "Access", "Joined", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-medium" style={{ color: "#6b7280" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => {
                    const isMe = u.user_id === user?.id;
                    const busy = busyRow === u.id;
                    return (
                      <tr
                        key={u.id}
                        style={{
                          background: i % 2 === 0 ? "#111" : "#131313",
                          borderBottom: "1px solid #1f1f1f",
                          opacity: busy ? 0.5 : 1,
                        }}
                      >
                        <td className="px-4 py-3" style={{ color: "#e5e5e5" }}>
                          {u.email}
                          {isMe && (
                            <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background: "#1a1a1a", color: "#6b7280" }}>
                              you
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={u.role}
                            disabled={busy || isMe}
                            onChange={(e) => updateUser(u.id, { role: e.target.value })}
                            className="rounded-lg px-2 py-1 text-xs outline-none"
                            style={{
                              background: ROLE_COLORS[u.role].bg,
                              color: ROLE_COLORS[u.role].color,
                              border: `1px solid ${ROLE_COLORS[u.role].border}`,
                              opacity: isMe ? 0.5 : 1,
                              cursor: isMe ? "not-allowed" : "pointer",
                            }}
                          >
                            <option value="member">member</option>
                            <option value="admin">admin</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={u.access}
                            disabled={busy || isMe}
                            onChange={(e) => updateUser(u.id, { access: e.target.value })}
                            className="rounded-lg px-2 py-1 text-xs outline-none"
                            style={{
                              background: ACCESS_COLORS[u.access].bg,
                              color: ACCESS_COLORS[u.access].color,
                              border: `1px solid ${ACCESS_COLORS[u.access].border}`,
                              opacity: isMe ? 0.5 : 1,
                              cursor: isMe ? "not-allowed" : "pointer",
                            }}
                          >
                            <option value="read">read</option>
                            <option value="write">write</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#6b7280" }}>
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => removeUser(u.id, u.email)}
                            disabled={busy || isMe}
                            className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                            style={{
                              color: "#f87171",
                              border: "1px solid #3a2020",
                              opacity: isMe || busy ? 0.3 : 1,
                              cursor: isMe || busy ? "not-allowed" : "pointer",
                            }}
                            onMouseEnter={(e) => { if (!isMe && !busy) e.currentTarget.style.background = "#2a1a1a"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                          >
                            {busy ? "…" : "Remove"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: "#4b5563" }}>
                        No users yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* ── Pending invites table ── */
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #2a2a2a" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "#1a1a1a", borderBottom: "1px solid #2a2a2a" }}>
                    {["Email", "Role", "Access", "Invited", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-medium" style={{ color: "#6b7280" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pendingInvites.map((inv, i) => {
                    const busy = busyRow === inv.id;
                    return (
                      <tr
                        key={inv.id}
                        style={{
                          background: i % 2 === 0 ? "#111" : "#131313",
                          borderBottom: "1px solid #1f1f1f",
                          opacity: busy ? 0.5 : 1,
                        }}
                      >
                        <td className="px-4 py-3" style={{ color: "#e5e5e5" }}>{inv.email}</td>
                        <td className="px-4 py-3"><Badge type="role" value={inv.role} /></td>
                        <td className="px-4 py-3"><Badge type="access" value={inv.access} /></td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#6b7280" }}>
                          {new Date(inv.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => cancelInvite(inv.id, inv.email)}
                            disabled={busy}
                            className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                            style={{
                              color: "#f87171",
                              border: "1px solid #3a2020",
                              opacity: busy ? 0.3 : 1,
                              cursor: busy ? "not-allowed" : "pointer",
                            }}
                            onMouseEnter={(e) => { if (!busy) e.currentTarget.style.background = "#2a1a1a"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                          >
                            {busy ? "…" : "Cancel"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {pendingInvites.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: "#4b5563" }}>
                        No pending invites.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
