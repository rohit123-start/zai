"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { createProjectWithSetup } from "@/lib/db";

const APP_TYPES = [
  "Booking & Appointments", "Marketplace", "E-commerce", "Social & Community",
  "Finance & Banking", "Health & Fitness", "Food & Delivery", "Education & Learning",
  "SaaS & Productivity", "Travel & Lifestyle", "AI Assistant & Chatbot", "AI Developer Tool", "Other",
];

const INDUSTRIES = [
  "Beauty & Wellness", "Food & Delivery", "Healthcare", "Finance & Banking",
  "Education", "Travel & Lifestyle", "E-commerce & Retail", "Social & Community",
  "Fitness & Sport", "AI & Technology", "Developer Tools", "Entertainment & Media",
  "Events & Ticketing", "Real Estate", "Transport & Logistics", "SaaS & Productivity",
  "Booking & Appointments", "Marketplace", "Other",
];

const PLATFORMS = [
  { id: "ios", label: "iOS", icon: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="5" y="2" width="14" height="20" rx="3"/><line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2.5"/></svg>
  )},
  { id: "android", label: "Android", icon: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 16a7 7 0 0114 0"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="2" y1="9" x2="4" y2="9"/><line x1="20" y1="9" x2="22" y2="9"/><path d="M7 2l2 3M15 2l-2 3"/><rect x="5" y="9" width="14" height="11" rx="2"/><line x1="9" y1="20" x2="9" y2="22"/><line x1="15" y1="20" x2="15" y2="22"/></svg>
  )},
  { id: "web", label: "Web", icon: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>
  )},
];

const inputBase: React.CSSProperties = {
  width: "100%",
  background: "#0a0a0a",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  padding: "13px 16px",
  fontSize: 14,
  fontFamily: "var(--font-dm-sans)",
  outline: "none",
  transition: "border-color 0.2s, box-shadow 0.2s",
  appearance: "none" as const,
};

function SelectInput({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "relative" }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...inputBase,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%233f3f46' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 14px center",
          paddingRight: 40,
          cursor: "pointer",
          color: value ? "#fff" : "#3f3f46",
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "#06b6d4"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(6,182,212,0.1)"; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
      >
        {children}
      </select>
    </div>
  );
}

export default function NewProjectPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [projectType, setProjectType] = useState<"existing_app" | "new_idea" | "">("");
  const [appType, setAppType] = useState("");
  const [industry, setIndustry] = useState("");
  const [primaryAction, setPrimaryAction] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [platform, setPlatform] = useState<string[]>([]);
  const [coreFeatures, setCoreFeatures] = useState("");
  const [setupNotes, setSetupNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function togglePlatform(id: string) {
    setPlatform((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  }

  const isValid = name.trim() && projectType && appType && industry && primaryAction.trim() && targetUser.trim() && platform.length > 0 && coreFeatures.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !isValid || !projectType) return;
    setSubmitting(true);
    setError("");
    try {
      const project = await createProjectWithSetup(user.id, {
        name: name.trim(),
        project_type: projectType,
        app_type: appType,
        industry,
        primary_action: primaryAction.trim(),
        target_user: targetUser.trim(),
        platform,
        core_features: coreFeatures.trim(),
        setup_notes: setupNotes.trim() || undefined,
      });
      router.push(`/projects/${project.id}/setup`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  const FieldLabel = ({ children, optional }: { children: React.ReactNode; optional?: boolean }) => (
    <label style={{ display: "block", fontFamily: "var(--font-dm-mono)", fontSize: 10, letterSpacing: "0.5px", textTransform: "uppercase" as const, color: "#3f3f46", marginBottom: 7 }}>
      {children}
      {optional && <span style={{ fontSize: 9, color: "#3f3f46", textTransform: "none" as const, letterSpacing: 0, opacity: 0.7, marginLeft: 6 }}>optional</span>}
    </label>
  );

  const focusStyle = { borderColor: "#06b6d4", boxShadow: "0 0 0 3px rgba(6,182,212,0.1)" };
  const blurStyle = { borderColor: "rgba(255,255,255,0.1)", boxShadow: "none" };

  return (
    <div className="min-h-screen overflow-y-auto relative" style={{ background: "#000", fontFamily: "var(--font-dm-sans)" }}>
      {/* Dot grid */}
      <div style={{ position: "fixed", inset: 0, backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)", backgroundSize: "32px 32px", pointerEvents: "none", zIndex: 0 }} />

      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-6" style={{ height: 56, background: "rgba(0,0,0,0.9)", borderBottom: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(14px)" }}>
        <button onClick={() => router.push("/")} className="flex items-center gap-1.5 transition-colors" style={{ color: "#71717a", fontFamily: "var(--font-dm-mono)", fontSize: 11, letterSpacing: "0.3px" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")} onMouseLeave={(e) => (e.currentTarget.style.color = "#71717a")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back
        </button>
        <div className="font-bold text-lg" style={{ color: "#fff", fontFamily: "var(--font-space-grotesk)", letterSpacing: "-0.4px" }}>zeach</div>
        <div style={{ fontFamily: "var(--font-dm-mono)", fontSize: 11, color: "#71717a" }}>
          Step <span style={{ color: "#06b6d4" }}>1</span> of 2
        </div>
      </header>

      {/* Progress bar */}
      <div style={{ height: 2, background: "rgba(255,255,255,0.06)" }}>
        <div style={{ height: "100%", width: "50%", background: "linear-gradient(90deg,#06b6d4,#22d3ee)", transition: "width 0.5s ease" }} />
      </div>

      {/* Content */}
      <main className="relative z-10" style={{ maxWidth: 560, margin: "0 auto", padding: "32px 24px 120px" }}>
        <p style={{ fontFamily: "var(--font-dm-mono)", fontSize: 10, letterSpacing: "0.6px", textTransform: "uppercase", color: "#06b6d4", marginBottom: 10 }}>Create Project</p>
        <h1 style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px", lineHeight: 1.25, color: "#fff", marginBottom: 8 }}>
          Tell us about<br />your project
        </h1>
        <p style={{ fontSize: 14, color: "#71717a", lineHeight: 1.6, marginBottom: 32 }}>
          The more you share, the smarter your project brain gets from day one.
        </p>

        <form id="new-project-form" onSubmit={handleSubmit} className="flex flex-col" style={{ gap: 20 }}>

          {/* Project Name */}
          <div>
            <FieldLabel>Project Name</FieldLabel>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. SalonEase, FinTrack, FoodDrop" autoFocus
              style={inputBase}
              onFocus={(e) => Object.assign(e.currentTarget.style, focusStyle)}
              onBlur={(e) => Object.assign(e.currentTarget.style, blurStyle)}
            />
          </div>

          {/* Type toggle */}
          <div>
            <FieldLabel>What are you building?</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: "existing_app" as const, label: "Existing App", sub: "Upload screenshots to modernise",
                  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="5" y="2" width="14" height="20" rx="3"/><line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2.5"/></svg> },
                { id: "new_idea" as const, label: "New Idea", sub: "Starting fresh with an idea",
                  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9 21h6M12 3a6 6 0 00-3.5 10.83A2 2 0 009 15.5V17h6v-1.5a2 2 0 00.5-1.67A6 6 0 0012 3z"/></svg> },
              ]).map(({ id, label, sub, icon }) => (
                <button key={id} type="button" onClick={() => setProjectType(id)}
                  style={{ background: projectType === id ? "rgba(6,182,212,0.1)" : "#0a0a0a", border: `1px solid ${projectType === id ? "#06b6d4" : "rgba(255,255,255,0.1)"}`, borderRadius: 12, padding: "16px 14px", textAlign: "left", cursor: "pointer", transition: "all 0.2s" }}>
                  <span style={{ display: "block", marginBottom: 8, color: projectType === id ? "#06b6d4" : "#3f3f46" }}>{icon}</span>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: projectType === id ? "#06b6d4" : "#fff", marginBottom: 3, fontFamily: "var(--font-space-grotesk)" }}>{label}</span>
                  <span style={{ display: "block", fontSize: 11, color: "#71717a", lineHeight: 1.4 }}>{sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* App Type + Industry */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>App Type</FieldLabel>
              <SelectInput value={appType} onChange={setAppType}>
                <option value="" disabled>Select app type</option>
                {APP_TYPES.map((t) => <option key={t} value={t} style={{ background: "#0a0a0a" }}>{t}</option>)}
              </SelectInput>
            </div>
            <div>
              <FieldLabel>Industry</FieldLabel>
              <SelectInput value={industry} onChange={setIndustry}>
                <option value="" disabled>Select your industry</option>
                {INDUSTRIES.map((i) => <option key={i} value={i} style={{ background: "#0a0a0a" }}>{i}</option>)}
              </SelectInput>
            </div>
          </div>

          {/* Primary Action */}
          <div>
            <FieldLabel>Primary Action</FieldLabel>
            <input type="text" value={primaryAction} onChange={(e) => setPrimaryAction(e.target.value)}
              placeholder="What is the ONE thing users come to do? e.g. Book a slot, Track expenses"
              style={inputBase}
              onFocus={(e) => Object.assign(e.currentTarget.style, focusStyle)}
              onBlur={(e) => Object.assign(e.currentTarget.style, blurStyle)}
            />
          </div>

          {/* Target User */}
          <div>
            <FieldLabel>Target User</FieldLabel>
            <input type="text" value={targetUser} onChange={(e) => setTargetUser(e.target.value)}
              placeholder="e.g. Working professionals aged 25-40 who want to manage finances on the go"
              style={inputBase}
              onFocus={(e) => Object.assign(e.currentTarget.style, focusStyle)}
              onBlur={(e) => Object.assign(e.currentTarget.style, blurStyle)}
            />
          </div>

          {/* Platform */}
          <div>
            <FieldLabel>Platform</FieldLabel>
            <div className="grid grid-cols-3 gap-2">
              {PLATFORMS.map(({ id, label, icon }) => (
                <button key={id} type="button" onClick={() => togglePlatform(id)}
                  style={{ background: platform.includes(id) ? "rgba(6,182,212,0.1)" : "#0a0a0a", border: `1px solid ${platform.includes(id) ? "#06b6d4" : "rgba(255,255,255,0.1)"}`, borderRadius: 10, padding: "14px 8px", textAlign: "center", cursor: "pointer", transition: "all 0.2s" }}>
                  <span style={{ display: "flex", margin: "0 auto 5px", width: 24, height: 24, alignItems: "center", justifyContent: "center", color: platform.includes(id) ? "#06b6d4" : "#3f3f46" }}>{icon}</span>
                  <span style={{ display: "block", fontFamily: "var(--font-dm-mono)", fontSize: 11, fontWeight: 600, color: platform.includes(id) ? "#06b6d4" : "#3f3f46", letterSpacing: "0.2px" }}>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Core Features */}
          <div>
            <FieldLabel>Core Features</FieldLabel>
            <textarea value={coreFeatures} onChange={(e) => setCoreFeatures(e.target.value)}
              placeholder="e.g. User login, booking calendar, payment, notifications, profile page"
              rows={3}
              style={{ ...inputBase, resize: "none", lineHeight: 1.6 }}
              onFocus={(e) => Object.assign(e.currentTarget.style, focusStyle)}
              onBlur={(e) => Object.assign(e.currentTarget.style, blurStyle)}
            />
          </div>

          {/* Notes */}
          <div>
            <FieldLabel optional>Additional Notes</FieldLabel>
            <textarea value={setupNotes} onChange={(e) => setSetupNotes(e.target.value)}
              placeholder="Anything else Zeach should know about your product or vision"
              rows={3}
              style={{ ...inputBase, resize: "none", lineHeight: 1.6 }}
              onFocus={(e) => Object.assign(e.currentTarget.style, focusStyle)}
              onBlur={(e) => Object.assign(e.currentTarget.style, blurStyle)}
            />
          </div>

          {error && (
            <p style={{ fontSize: 13, padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.06)", color: "#f87171", border: "1px solid rgba(239,68,68,0.15)" }}>
              {error}
            </p>
          )}
        </form>
      </main>

      {/* Fixed CTA */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, padding: "12px 24px", background: "rgba(0,0,0,0.92)", borderTop: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(14px)" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <button
            type="submit"
            form="new-project-form"
            disabled={!isValid || submitting}
            style={{
              width: "100%",
              background: !isValid || submitting ? "rgba(6,182,212,0.4)" : "#06b6d4",
              color: !isValid || submitting ? "rgba(0,0,0,0.4)" : "#000",
              border: "none",
              borderRadius: 10,
              padding: 15,
              fontFamily: "var(--font-space-grotesk)",
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "-0.2px",
              cursor: !isValid || submitting ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "all 0.2s",
              boxShadow: isValid && !submitting ? "0 0 24px rgba(6,182,212,0.3)" : "none",
            }}
          >
            {submitting ? "Creating…" : "Continue to Visual Style"}
            {!submitting && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
