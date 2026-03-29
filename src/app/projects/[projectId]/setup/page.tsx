"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import {
  getProject, getThemeByName, getGlobalTheme,
  type Theme,
} from "@/lib/db";
import { createClient } from "@/lib/supabase/client";
import {
  ZEACH_THEMES,
  ALL_FONT_PAIRS,
  getIndustryThemes,
  getRecommendedFontPair,
  type ZeachTheme,
  type FontPairDef,
} from "@/lib/zeach-theme-catalog";

// ─── Upload helper ────────────────────────────────────────────────────────────

async function uploadFile(
  projectId: string,
  file: File,
  folder: "screenshots" | "inspiration"
): Promise<string | null> {
  const supabase = createClient();
  const ext = file.name.split(".").pop();
  const path = `${projectId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from("project-assets")
    .upload(path, file, { upsert: true });
  if (error) return null;
  const { data } = supabase.storage.from("project-assets").getPublicUrl(path);
  return data.publicUrl;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DropZone({
  label, sub, icon, files, onFiles, accept,
}: {
  label: string; sub: string; icon: React.ReactNode;
  files: File[]; onFiles: (f: File[]) => void; accept: string;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (dropped.length) onFiles([...files, ...dropped]);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length) onFiles([...files, ...selected]);
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-2 px-6 py-6 rounded-xl cursor-pointer transition-all"
        style={{ border: `1px dashed ${dragging ? "#06b6d4" : "rgba(255,255,255,0.1)"}`, background: dragging ? "rgba(6,182,212,0.1)" : "#0a0a0a" }}
      >
        <span style={{ color: dragging ? "#06b6d4" : "#3f3f46" }}>{icon}</span>
        <p className="text-sm font-semibold" style={{ color: "#fff" }}>{label}</p>
        <p className="text-xs text-center" style={{ color: "#71717a" }}>{sub}</p>
        <input ref={inputRef} type="file" multiple accept={accept} className="hidden" onChange={handleChange} />
      </div>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={i} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(f)} alt={f.name} className="w-16 h-16 rounded-lg object-cover"
                style={{ border: "1px solid rgba(255,255,255,0.1)" }} />
              <button type="button" onClick={() => onFiles(files.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: "#ef4444", color: "#fff" }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Theme card uses hardcoded ZeachTheme tokens for the live preview swatch. */
function ThemeCard({
  name, theme, selected, loading, onClick,
}: {
  name: string; theme: ZeachTheme; selected: boolean; loading: boolean; onClick: () => void;
}) {
  const t = theme;
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-xl overflow-hidden transition-all"
      style={{
        border: selected ? "1px solid #06b6d4" : "1px solid rgba(255,255,255,0.08)",
        boxShadow: selected ? "0 0 0 1px #06b6d4" : "none",
        opacity: loading ? 0.7 : 1,
      }}
    >
      {/* Live preview swatch */}
      <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 12, background: t.background, overflow: "hidden" }}>
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ height: 5, borderRadius: 3, background: t.primary, width: "55%" }} />
          <div style={{ height: 26, borderRadius: 6, background: t.surface2, border: `1px solid ${t.border}`, display: "flex", alignItems: "center", padding: "0 7px", gap: 4 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: t.primary, flexShrink: 0 }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ height: 2.5, borderRadius: 2, background: t.text, opacity: 0.4, width: "65%" }} />
              <div style={{ height: 2, borderRadius: 1.5, background: t.text, opacity: 0.15, width: "40%" }} />
            </div>
            <div style={{ height: 12, width: 32, borderRadius: 4, background: t.primary }} />
          </div>
        </div>
      </div>
      {/* Info */}
      <div style={{ padding: "10px 12px", background: "#0a0a0a" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 2, fontFamily: "var(--font-space-grotesk)" }}>{name}</p>
        <p style={{ fontSize: 10, color: "#52525b", lineHeight: 1.4, marginBottom: 2 }}>{t.desc}</p>
        <p style={{ fontSize: 10, color: "#3f3f46", fontFamily: "var(--font-dm-mono)" }}>
          {t.heading_font} · {t.animation_speed}
        </p>
      </div>
      {selected && (
        <div className="flex items-center gap-1 px-3 py-1" style={{ background: "#06b6d4" }}>
          {loading ? (
            <svg style={{ animation: "spin 0.6s linear infinite" }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          )}
          <span style={{ fontSize: 10, fontWeight: 600, color: "#000", fontFamily: "var(--font-dm-mono)" }}>
            {loading ? "Loading…" : "Selected"}
          </span>
        </div>
      )}
    </button>
  );
}

/** Font pairing card with recommended badge and live font preview. */
function FontCard({
  pair, selected, recommended, onClick,
}: {
  pair: FontPairDef; selected: boolean; recommended: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left flex items-center justify-between rounded-xl transition-all"
      style={{
        background: selected ? "rgba(6,182,212,0.1)" : "#0a0a0a",
        border: `1px solid ${selected ? "#06b6d4" : recommended ? "rgba(6,182,212,0.25)" : "rgba(255,255,255,0.1)"}`,
        padding: "14px 16px",
      }}
    >
      <div style={{ flex: 1 }}>
        <div className="flex items-center gap-2 mb-1">
          <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: `"${pair.heading}", ${pair.body === "Geist Mono" || pair.body === "Courier Prime" ? "monospace" : "sans-serif"}` }}>
            {pair.mood}
          </p>
          {recommended && (
            <span style={{ fontSize: 9, fontFamily: "var(--font-dm-mono)", letterSpacing: "0.4px", color: "#06b6d4", background: "rgba(6,182,212,0.12)", padding: "2px 6px", borderRadius: 4, border: "1px solid rgba(6,182,212,0.25)" }}>
              RECOMMENDED
            </span>
          )}
        </div>
        <p style={{ fontSize: 11, color: "#71717a", fontFamily: "var(--font-dm-mono)" }}>
          {pair.heading} · {pair.body}
        </p>
      </div>
      <div
        style={{
          width: 8, height: 8, borderRadius: "50%",
          background: selected ? "#06b6d4" : recommended ? "rgba(6,182,212,0.4)" : "rgba(255,255,255,0.1)",
          boxShadow: selected ? "0 0 6px rgba(6,182,212,0.5)" : "none",
          flexShrink: 0, transition: "all 0.2s",
        }}
      />
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function VisualDirectionPageInner() {
  const router = useRouter();
  const { projectId } = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  // runId from Screen 1 classify call — passed as ?runId=...
  const classifyRunId = searchParams.get("runId") ?? "";

  const [project, setProject] = useState<Awaited<ReturnType<typeof getProject>>>(null);
  // kept for potential future use in brain fallback
  const [, setGlobalTokens] = useState<Awaited<ReturnType<typeof getGlobalTheme>>>(null);

  // uploads
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [inspirationFiles, setInspirationFiles] = useState<File[]>([]);
  const [referenceUrl, setReferenceUrl] = useState("");
  const [referenceUrls, setReferenceUrls] = useState<string[]>([]);
  const [refFocused, setRefFocused] = useState(false);

  // selections
  const [selectedPack, setSelectedPack] = useState("");
  const [selectedFont, setSelectedFont] = useState("");
  // DB-fetched tokens for the selected theme (null = use catalog fallback)
  const [selectedThemeFromDB, setSelectedThemeFromDB] = useState<Theme | null>(null);
  const [themeLoading, setThemeLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Derived: themes + fonts for this project's industry
  const industry = project?.industry ?? "";
  const industryThemes = getIndustryThemes(industry);
  const recommendedFontPair = getRecommendedFontPair(industry);

  // Ordered font pairs: recommended first, then rest
  const orderedFontPairs: FontPairDef[] = [
    recommendedFontPair,
    ...ALL_FONT_PAIRS.filter((fp) => fp.id !== recommendedFontPair.id),
  ];

  // Load Google Fonts (only the ones with googleUrl)
  useEffect(() => {
    const urls = orderedFontPairs.filter((fp) => fp.googleUrl).map((fp) => fp.googleUrl).join("&");
    if (!urls) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${urls}&display=swap`;
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    getProject(projectId).then(setProject);
    getGlobalTheme().then(setGlobalTokens);
  }, [projectId]);

  // Auto-select recommended font when industry is known
  useEffect(() => {
    if (!industry) return;
    setSelectedFont(recommendedFontPair.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [industry]);

  // Auto-select font from chosen theme (if theme's font is in our pairs list)
  useEffect(() => {
    if (!selectedPack) return;
    const themeDef = ZEACH_THEMES[selectedPack];
    if (!themeDef) return;
    const match = ALL_FONT_PAIRS.find(
      (fp) => fp.heading === themeDef.heading_font && fp.body === themeDef.body_font
    );
    if (match) setSelectedFont(match.id);
  }, [selectedPack]);

  const isExistingApp = project?.project_type === "existing_app";

  function addReferenceUrl() {
    const url = referenceUrl.trim();
    if (!url) return;
    setReferenceUrls((prev) => [...prev, url]);
    setReferenceUrl("");
  }

  /** Click on a theme card — update selection and fetch full tokens from DB. */
  async function handleThemeClick(name: string) {
    setSelectedPack(name);
    setSelectedThemeFromDB(null);
    setThemeLoading(true);
    try {
      const dbTheme = await getThemeByName(name);
      setSelectedThemeFromDB(dbTheme);
    } catch {
      // fall through — will use catalog tokens as fallback
    } finally {
      setThemeLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPack || !selectedFont) {
      setError("Please select a Style Pack and Font Pairing.");
      return;
    }
    setSubmitting(true);
    setError("");

    // 1. Upload files
    const screenshotUrls: string[] = [];
    for (const file of screenshots) {
      const url = await uploadFile(projectId, file, "screenshots");
      if (url) screenshotUrls.push(url);
    }
    const inspirationUrls: string[] = [];
    for (const file of inspirationFiles) {
      const url = await uploadFile(projectId, file, "inspiration");
      if (url) inspirationUrls.push(url);
    }

    // 2. Get authenticated userId
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated. Please sign in again.");
      setSubmitting(false);
      return;
    }

    const fontPair = orderedFontPairs.find((f) => f.id === selectedFont);
    const fontPairLabel = fontPair
      ? `${fontPair.heading} + ${fontPair.body}`
      : selectedPack;

    // 3. Build S1 + S2 for the pipeline
    const s1 = {
      project_name: project!.name,
      description:  project!.description ?? "",
      industry:     project!.industry ?? "",
      app_type:     project!.app_type ?? "",
      project_type: project!.project_type ?? "new_idea",
      features:     project!.features ?? [],
    };

    const s2 = {
      style_pack:      selectedPack,
      font_pairing:    fontPairLabel,
      screenshot_urls: screenshotUrls,
      inspiration_urls: inspirationUrls,
      reference_urls:  referenceUrls,
    };

    console.log("[pipeline] Starting zeach pipeline v3…");
    console.log("[pipeline] s1:", s1);
    console.log("[pipeline] s2:", s2);

    // 4. Run the full pipeline (Steps 01.5 → 09.8) server-side
    try {
      const res = await fetch("/api/run-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          userId: user.id,
          s1,
          s2,
          // If Screen 1 already ran classify, pass the runId so pipeline skips steps 01–01.5c
          ...(classifyRunId ? { pipelineRunId: classifyRunId } : {}),
        }),
      });

      if (!res.ok) {
        const errData = await res.json() as { error?: string };
        throw new Error(errData.error ?? `Pipeline failed (${res.status})`);
      }

      const data = await res.json() as {
        pipelineRunId: string;
        screens: string[];
        qualityScore: number;
        qualityResult: string;
        qualityWarnings: string[];
        durationMs: number;
      };

      console.log(`[pipeline] ✓ Complete | runId=${data.pipelineRunId} | ${data.screens.length} screens | quality=${data.qualityScore} (${data.qualityResult}) | ${data.durationMs}ms`);
      if (data.qualityWarnings?.length > 0) {
        console.warn("[pipeline] Quality warnings:", data.qualityWarnings);
      }

      // Redirect to project — pages/app.html already saved, no ?init=1 needed
      router.push(`/projects/${projectId}`);
    } catch (err) {
      console.error("[pipeline] Error:", err);
      setError(err instanceof Error ? err.message : "Pipeline failed. Please try again.");
      setSubmitting(false);
    }
  }

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontFamily: "var(--font-dm-mono)", fontSize: 10, letterSpacing: "0.5px", textTransform: "uppercase" as const, color: "#3f3f46", marginBottom: 10 }}>
      {children}
    </div>
  );

  const OrDivider = ({ label = "and / or" }: { label?: string }) => (
    <div className="flex items-center gap-3" style={{ margin: "18px 0" }}>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
      <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: 10, color: "#3f3f46", letterSpacing: "0.4px" }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
    </div>
  );

  const canSubmit = selectedPack && selectedFont;

  return (
    <div className="min-h-screen overflow-y-auto relative" style={{ background: "#000", fontFamily: "var(--font-dm-sans)" }}>
      {/* Dot grid */}
      <div style={{ position: "fixed", inset: 0, backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)", backgroundSize: "32px 32px", pointerEvents: "none", zIndex: 0 }} />

      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-6" style={{ height: 56, background: "rgba(0,0,0,0.9)", borderBottom: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(14px)" }}>
        <button onClick={() => router.back()} className="flex items-center gap-1.5 transition-colors"
          style={{ color: "#71717a", fontFamily: "var(--font-dm-mono)", fontSize: 11, letterSpacing: "0.3px", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")} onMouseLeave={(e) => (e.currentTarget.style.color = "#71717a")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back
        </button>
        <div className="font-bold text-lg" style={{ color: "#fff", fontFamily: "var(--font-space-grotesk)", letterSpacing: "-0.4px" }}>zeach</div>
        <div style={{ fontFamily: "var(--font-dm-mono)", fontSize: 11, color: "#71717a" }}>
          Step <span style={{ color: "#06b6d4" }}>2</span> of 2
        </div>
      </header>

      {/* Progress bar */}
      <div style={{ height: 2, background: "rgba(255,255,255,0.06)" }}>
        <div style={{ height: "100%", width: "100%", background: "linear-gradient(90deg,#06b6d4,#22d3ee)" }} />
      </div>

      <main className="relative z-10" style={{ maxWidth: 560, margin: "0 auto", padding: "32px 24px 120px" }}>
        <p style={{ fontFamily: "var(--font-dm-mono)", fontSize: 10, letterSpacing: "0.6px", textTransform: "uppercase", color: "#06b6d4", marginBottom: 10 }}>Visual Direction</p>
        <h1 style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px", lineHeight: 1.25, color: "#fff", marginBottom: 8 }}>
          Set your visual<br />direction
        </h1>
        <p style={{ fontSize: 14, color: "#71717a", lineHeight: 1.6, marginBottom: 8 }}>
          Upload your app, add inspiration, or choose a theme built for your industry.
        </p>

        {industry && (
          <div className="inline-flex items-center gap-1.5 rounded-full mb-6"
            style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)", padding: "5px 12px", fontFamily: "var(--font-dm-mono)", fontSize: 11, fontWeight: 500, color: "#06b6d4" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {industry} — {industryThemes.length} curated themes
          </div>
        )}

        <form id="setup-form" onSubmit={handleSubmit} className="flex flex-col" style={{ gap: 28 }}>

          {/* Upload existing app */}
          {isExistingApp && (
            <div>
              <SectionLabel>Upload Existing App</SectionLabel>
              <DropZone
                label="Drop your app screenshots"
                sub="PNG · JPG · Figma exports · Up to 10 screens"
                icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>}
                files={screenshots}
                onFiles={(f) => setScreenshots(f.slice(0, 10))}
                accept="image/*"
              />
              <OrDivider />
            </div>
          )}

          {/* Inspiration */}
          <div>
            <SectionLabel>Add Inspiration</SectionLabel>
            <div className="grid grid-cols-2 gap-2.5">
              <DropZone
                label="Inspiration"
                sub="Drop images or moodboards"
                icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>}
                files={inspirationFiles}
                onFiles={setInspirationFiles}
                accept="image/*"
              />
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl"
                  style={{ border: "1px dashed rgba(255,255,255,0.1)", background: "#0a0a0a", padding: "18px 12px", flex: 1 }}>
                  <span style={{ color: "#3f3f46" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                  </span>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Reference URL</p>
                  <p style={{ fontSize: 11, color: "#71717a", textAlign: "center" }}>Paste any live app or website</p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={referenceUrl}
                    onChange={(e) => setReferenceUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addReferenceUrl(); } }}
                    placeholder="https://example.com"
                    className="flex-1 rounded-lg text-xs outline-none"
                    style={{ background: "#0a0a0a", color: "#fff", border: `1px solid ${refFocused ? "#06b6d4" : "rgba(255,255,255,0.1)"}`, padding: "8px 10px", fontFamily: "var(--font-dm-sans)", fontSize: 12 }}
                    onFocus={() => setRefFocused(true)}
                    onBlur={() => setRefFocused(false)}
                  />
                  <button type="button" onClick={addReferenceUrl} className="rounded-lg text-xs font-medium"
                    style={{ background: "rgba(6,182,212,0.1)", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.2)", padding: "8px 12px", fontFamily: "var(--font-dm-mono)" }}>
                    Add
                  </button>
                </div>
                {referenceUrls.map((url, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontSize: 11, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#71717a" }}>{url}</span>
                    <button type="button" onClick={() => setReferenceUrls((p) => p.filter((_, j) => j !== i))} style={{ color: "#3f3f46", fontSize: 14, lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <OrDivider label="or choose a style" />

          {/* ── Style Themes — hardcoded from zeach-theme-catalog ── */}
          <div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
              <SectionLabel>
                {industry ? `${industry} Themes` : "Style Themes"}
              </SectionLabel>
              {selectedPack && !themeLoading && (
                <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: 9, color: selectedThemeFromDB ? "#10b981" : "#f59e0b", letterSpacing: "0.3px" }}>
                  {selectedThemeFromDB ? "✓ tokens from DB" : "⚠ using catalog tokens"}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {industryThemes.map(({ name, theme }) => (
                <ThemeCard
                  key={name}
                  name={name}
                  theme={theme}
                  selected={selectedPack === name}
                  loading={themeLoading && selectedPack === name}
                  onClick={() => handleThemeClick(name)}
                />
              ))}
            </div>
          </div>

          {/* ── Font Pairing — industry-recommended highlighted ── */}
          <div>
            <SectionLabel>Font Pairing</SectionLabel>
            <div className="flex flex-col gap-2">
              {orderedFontPairs.map((pair) => (
                <FontCard
                  key={pair.id}
                  pair={pair}
                  selected={selectedFont === pair.id}
                  recommended={pair.id === recommendedFontPair.id}
                  onClick={() => setSelectedFont(pair.id)}
                />
              ))}
            </div>
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
            form="setup-form"
            disabled={submitting || !canSubmit}
            style={{
              width: "100%",
              background: submitting || !canSubmit ? "rgba(6,182,212,0.4)" : "#06b6d4",
              color: submitting || !canSubmit ? "rgba(0,0,0,0.4)" : "#000",
              border: "none", borderRadius: 10, padding: 15,
              fontFamily: "var(--font-space-grotesk)", fontSize: 15, fontWeight: 700, letterSpacing: "-0.2px",
              cursor: submitting || !canSubmit ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.2s",
              boxShadow: canSubmit && !submitting ? "0 0 24px rgba(6,182,212,0.3)" : "none",
            }}
          >
            {submitting ? (
              <>
                <svg style={{ animation: "spin 0.8s linear infinite" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
                  <path d="M12 2a10 10 0 0 1 10 10"/>
                </svg>
                Running pipeline…
              </>
            ) : (
              <>
                Generate App
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </>
            )}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function VisualDirectionPage() {
  return (
    <Suspense>
      <VisualDirectionPageInner />
    </Suspense>
  );
}
