"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { createProjectWithSetup, getIndustries, getProducts, type Industry, type Product } from "@/lib/db";

const FEATURES = [
  { id: "Authentication", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> },
  { id: "Payments", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
  { id: "Chat / Messaging", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> },
  { id: "Notifications", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg> },
  { id: "Search & Filters", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> },
  { id: "Maps / Location", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> },
  { id: "Analytics / Dashboard", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  { id: "File Upload", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> },
  { id: "Video / Calls", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg> },
];

const COMPLEXITY_OPTIONS = [
  { id: "MVP", sub: "Simple prototype", screens: "8–10 screens" },
  { id: "Startup", sub: "Full product", screens: "12–18 screens" },
  { id: "Scale", sub: "Advanced system", screens: "20–30+ screens" },
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

function SelectInput({ value, onChange, children, disabled }: { value: string; onChange: (v: string) => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{
        ...inputBase,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%233f3f46' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 14px center",
        paddingRight: 40,
        cursor: disabled ? "not-allowed" : "pointer",
        color: value ? "#fff" : "#3f3f46",
        opacity: disabled ? 0.5 : 1,
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "#06b6d4"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(6,182,212,0.1)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
    >
      {children}
    </select>
  );
}

export default function NewProjectPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [appType, setAppType] = useState("");
  const [projectType, setProjectType] = useState<"new_idea" | "existing_app">("new_idea");
  const [complexity, setComplexity] = useState("MVP");
  const [features, setFeatures] = useState<string[]>([]);
  const [setupNotes, setSetupNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());

  const [industries, setIndustries] = useState<Industry[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    Promise.all([getIndustries(), getProducts()])
      .then(([inds, prods]) => { setIndustries(inds); setProducts(prods); })
      .catch(console.error)
      .finally(() => setLoadingOptions(false));
  }, []);

  const filteredProducts = useMemo(
    () =>
      industry
        ? products.filter((p) => p.valid_industries.length === 0 || p.valid_industries.includes(industry))
        : products,
    [industry, products],
  );

  // Auto-select when exactly one app type is available; reset when the list changes
  useEffect(() => {
    if (filteredProducts.length === 1) {
      setAppType(filteredProducts[0].name);
      setInvalidFields((prev) => { const next = new Set(prev); next.delete("appType"); return next; });
    } else if (filteredProducts.length !== 1 && appType && !filteredProducts.some((p) => p.name === appType)) {
      setAppType("");
    }
  // appType intentionally excluded — we only react to the list changing, not appType itself
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredProducts]);

  function toggleFeature(id: string) {
    setFeatures((prev) => prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]);
  }

  function clearInvalid(field: string) {
    setInvalidFields((prev) => { const next = new Set(prev); next.delete(field); return next; });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const invalid = new Set<string>();
    if (!name.trim()) invalid.add("name");
    if (!description.trim()) invalid.add("description");
    if (!industry) invalid.add("industry");
    if (!appType) invalid.add("appType");

    if (invalid.size > 0) {
      setInvalidFields(invalid);
      // Scroll to first invalid field
      const firstKey = ["name", "description", "industry", "appType"].find((k) => invalid.has(k));
      if (firstKey && fieldRefs.current[firstKey]) {
        fieldRefs.current[firstKey]!.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    if (!user) return;
    setSubmitting(true);
    setError("");
    try {
      const project = await createProjectWithSetup(user.id, {
        name: name.trim(),
        description: description.trim(),
        project_type: projectType,
        app_type: appType,
        industry,
        complexity,
        features,
        setup_notes: setupNotes.trim() || undefined,
      });
      router.push(`/projects/${project.id}/setup`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  const FieldLabel = ({ children, optional }: { children: React.ReactNode; optional?: boolean }) => (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-dm-mono)", fontSize: 10, letterSpacing: "0.5px", textTransform: "uppercase" as const, color: "#3f3f46", marginBottom: 7 }}>
      {children}
      {optional && <span style={{ fontSize: 9, color: "#3f3f46", textTransform: "none" as const, letterSpacing: 0, opacity: 0.7 }}>optional</span>}
    </label>
  );

  const FieldError = ({ show, msg }: { show: boolean; msg: string }) => (
    <div style={{ fontFamily: "var(--font-dm-mono)", fontSize: 10, color: "#ef4444", marginTop: 5, letterSpacing: "0.2px", display: show ? "block" : "none" }}>
      {msg}
    </div>
  );

  const isInvalid = (f: string) => invalidFields.has(f);
  const borderColor = (f: string) => isInvalid(f) ? "#ef4444" : "rgba(255,255,255,0.1)";

  return (
    <div className="min-h-screen overflow-y-auto relative" style={{ background: "#000", fontFamily: "var(--font-dm-sans)" }}>
      {/* Dot grid bg */}
      <div style={{ position: "fixed", inset: 0, backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)", backgroundSize: "32px 32px", pointerEvents: "none", zIndex: 0 }} />

      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-6" style={{ height: 56, background: "rgba(0,0,0,0.9)", borderBottom: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(14px)" }}>
        <button onClick={() => router.push("/")} className="flex items-center gap-1.5 transition-colors" style={{ background: "none", border: "none", color: "#71717a", fontFamily: "var(--font-dm-mono)", fontSize: 11, letterSpacing: "0.3px", cursor: "pointer", padding: 0 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")} onMouseLeave={(e) => (e.currentTarget.style.color = "#71717a")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back
        </button>
        <div style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 18, fontWeight: 700, letterSpacing: "-0.4px", color: "#fff" }}>zeach</div>
        <div style={{ fontFamily: "var(--font-dm-mono)", fontSize: 11, color: "#71717a" }}>
          Step <span style={{ color: "#06b6d4" }}>1</span> of 2
        </div>
      </header>

      {/* Progress */}
      <div style={{ height: 2, background: "rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <div style={{ height: "100%", width: "50%", background: "linear-gradient(90deg,#06b6d4,#22d3ee)", transition: "width 0.5s ease" }} />
      </div>

      {/* Content */}
      <main className="relative z-10" style={{ maxWidth: 560, width: "100%", margin: "0 auto", padding: "32px 24px 120px" }}>
        <p style={{ fontFamily: "var(--font-dm-mono)", fontSize: 10, letterSpacing: "0.6px", textTransform: "uppercase", color: "#06b6d4", marginBottom: 10 }}>Create Project</p>
        <h1 style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px", lineHeight: 1.25, color: "#fff", marginBottom: 8 }}>
          Tell us about<br />your project
        </h1>
        <p style={{ fontSize: 14, color: "#71717a", lineHeight: 1.6, marginBottom: 32 }}>
          The more you share, the smarter your project brain gets from day one.
        </p>

        <form id="new-project-form" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Project Name */}
          <div ref={(el) => { fieldRefs.current["name"] = el; }}
            style={{ animation: isInvalid("name") ? "fieldShake 0.3s ease" : undefined }}>
            <FieldLabel>Project Name</FieldLabel>
            <input type="text" value={name} onChange={(e) => { setName(e.target.value); clearInvalid("name"); }}
              placeholder="e.g. SalonEase, FinTrack, DoorDash" autoFocus
              style={{ ...inputBase, borderColor: borderColor("name") }}
              onFocus={(e) => { if (!isInvalid("name")) e.currentTarget.style.borderColor = "#06b6d4"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(6,182,212,0.1)"; }}
              onBlur={(e) => { if (!isInvalid("name")) e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
            />
            <FieldError show={isInvalid("name")} msg="Please enter a project name" />
          </div>

          {/* Description */}
          <div ref={(el) => { fieldRefs.current["description"] = el; }}
            style={{ animation: isInvalid("description") ? "fieldShake 0.3s ease" : undefined }}>
            <FieldLabel>Describe your idea</FieldLabel>
            <textarea value={description} onChange={(e) => { setDescription(e.target.value); clearInvalid("description"); }}
              placeholder="What does your app do? Who is it for? What problem does it solve?"
              style={{ ...inputBase, resize: "none", height: 88, lineHeight: "1.6", borderColor: borderColor("description") }}
              onFocus={(e) => { if (!isInvalid("description")) e.currentTarget.style.borderColor = "#06b6d4"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(6,182,212,0.1)"; }}
              onBlur={(e) => { if (!isInvalid("description")) e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
            />
            <FieldError show={isInvalid("description")} msg="Please describe your idea" />
          </div>

          {/* Industry */}
          <div ref={(el) => { fieldRefs.current["industry"] = el; }}
            style={{ animation: isInvalid("industry") ? "fieldShake 0.3s ease" : undefined }}>
            <FieldLabel>Industry</FieldLabel>
            <SelectInput value={industry} onChange={(v) => { setIndustry(v); setAppType(""); clearInvalid("industry"); }}>
              <option value="" disabled>{loadingOptions ? "Loading…" : "Select industry"}</option>
              {industries.map((i) => <option key={i.slug} value={i.name} style={{ background: "#111" }}>{i.name}</option>)}
            </SelectInput>
            <FieldError show={isInvalid("industry")} msg="Please select an industry" />
          </div>

          {/* App Type */}
          <div ref={(el) => { fieldRefs.current["appType"] = el; }}
            style={{ animation: isInvalid("appType") ? "fieldShake 0.3s ease" : undefined }}>
            <FieldLabel>App Type</FieldLabel>
            <SelectInput value={appType} onChange={(v) => { setAppType(v); clearInvalid("appType"); }}>
              <option value="" disabled>{loadingOptions ? "Loading…" : "What type of app is this?"}</option>
              {filteredProducts.map((p) => <option key={p.archetype_id} value={p.name} style={{ background: "#111" }}>{p.name}</option>)}
            </SelectInput>
            <FieldError show={isInvalid("appType")} msg="Please select an app type" />
          </div>

          {/* What are you building */}
          <div>
            <FieldLabel>What are you building?</FieldLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {([
                { id: "new_idea" as const, label: "New Idea", sub: "Starting fresh with an idea",
                  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9 21h6M12 3a6 6 0 00-3.5 10.83A2 2 0 009 15.5V17h6v-1.5a2 2 0 00.5-1.67A6 6 0 0012 3z"/></svg> },
                { id: "existing_app" as const, label: "Existing App", sub: "Upload screenshots to modernise",
                  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="5" y="2" width="14" height="20" rx="3"/><line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2.5"/></svg> },
              ]).map(({ id, label, sub, icon }) => (
                <button key={id} type="button" onClick={() => setProjectType(id)}
                  style={{ background: projectType === id ? "rgba(6,182,212,0.1)" : "#0a0a0a", border: `1px solid ${projectType === id ? "#06b6d4" : "rgba(255,255,255,0.1)"}`, borderRadius: 12, padding: "16px 14px", textAlign: "center", cursor: "pointer", transition: "all 0.2s" }}>
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, margin: "0 auto 8px", color: projectType === id ? "#06b6d4" : "#3f3f46" }}>{icon}</span>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: projectType === id ? "#06b6d4" : "#fff", marginBottom: 3, fontFamily: "var(--font-space-grotesk)" }}>{label}</span>
                  <span style={{ display: "block", fontSize: 11, color: "#71717a", lineHeight: 1.4 }}>{sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Complexity */}
          <div>
            <FieldLabel>Complexity</FieldLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {COMPLEXITY_OPTIONS.map(({ id, sub, screens }) => (
                <button key={id} type="button" onClick={() => setComplexity(id)}
                  style={{ background: complexity === id ? "rgba(6,182,212,0.1)" : "#0a0a0a", border: `1px solid ${complexity === id ? "#06b6d4" : "rgba(255,255,255,0.06)"}`, borderRadius: 10, padding: "12px 10px", cursor: "pointer", transition: "all 0.15s", textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 3 }}>{id}</div>
                  <div style={{ fontSize: 10, color: "#3f3f46", marginBottom: 4 }}>{sub}</div>
                  <div style={{ fontFamily: "var(--font-dm-mono)", fontSize: 9, color: complexity === id ? "#06b6d4" : "#3f3f46", letterSpacing: "0.3px" }}>{screens}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Features */}
          <div>
            <FieldLabel optional>Features</FieldLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {FEATURES.map(({ id, icon }) => (
                <button key={id} type="button" onClick={() => toggleFeature(id)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 11px", border: `1px solid ${features.includes(id) ? "#06b6d4" : "rgba(255,255,255,0.06)"}`, borderRadius: 20, fontFamily: "var(--font-dm-sans)", fontSize: 12, color: features.includes(id) ? "#06b6d4" : "#3f3f46", cursor: "pointer", transition: "all 0.15s", background: features.includes(id) ? "rgba(6,182,212,0.1)" : "#0a0a0a", whiteSpace: "nowrap" }}>
                  <span style={{ color: "currentColor", flexShrink: 0 }}>{icon}</span>
                  {id}
                </button>
              ))}
            </div>
          </div>

          {/* Additional Notes */}
          <div>
            <FieldLabel optional>Additional Notes</FieldLabel>
            <textarea value={setupNotes} onChange={(e) => setSetupNotes(e.target.value)}
              placeholder="Anything else Zeach should know about your product, users or vision"
              style={{ ...inputBase, resize: "none", height: 88, lineHeight: "1.6" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#06b6d4"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(6,182,212,0.1)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
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
            disabled={submitting}
            style={{
              width: "100%",
              background: "#06b6d4",
              color: "#000",
              border: "none",
              borderRadius: 10,
              padding: 15,
              fontFamily: "var(--font-space-grotesk)",
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "-0.2px",
              cursor: submitting ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "all 0.2s",
              boxShadow: "0 0 24px rgba(6,182,212,0.3)",
              opacity: submitting ? 0.6 : 1,
            }}
            onMouseEnter={(e) => { if (!submitting) { e.currentTarget.style.background = "#22d3ee"; e.currentTarget.style.boxShadow = "0 0 32px rgba(6,182,212,0.45)"; } }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#06b6d4"; e.currentTarget.style.boxShadow = "0 0 24px rgba(6,182,212,0.3)"; }}
          >
            {submitting ? "Creating…" : "Continue to Visual Style"}
            {!submitting && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fieldShake {
          0%,100% { transform: translateX(0); }
          20%,60% { transform: translateX(-4px); }
          40%,80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
