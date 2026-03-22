"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  getProject, getThemes, getGlobalTheme, saveVisualDirection,
  type Theme,
} from "@/lib/db";
import { generateBrain } from "@/lib/brain-generator";
import { createClient } from "@/lib/supabase/client";

// ─── Font pairings ────────────────────────────────────────────────────────────

type FontPair = {
  id: string;
  heading: string;
  body: string;
  label: string;
  mood: string;
  previewHeading: string;
  previewBody: string;
  googleUrl: string;
};

const FONT_PAIRS: FontPair[] = [
  {
    id: "playfair-dm",
    heading: "Playfair Display",
    body: "DM Sans",
    label: "Playfair Display + DM Sans",
    mood: "Elegant",
    previewHeading: "Beautiful Design",
    previewBody: "Clear, modern type that works at any scale.",
    googleUrl: "family=Playfair+Display:wght@400;600&family=DM+Sans:wght@400;500",
  },
  {
    id: "inter-inter",
    heading: "Inter",
    body: "Inter",
    label: "Inter + Inter",
    mood: "Clean modern",
    previewHeading: "Precision & Clarity",
    previewBody: "The typeface built for screens. Nothing extra.",
    googleUrl: "family=Inter:wght@400;500;600",
  },
  {
    id: "cormorant-nunito",
    heading: "Cormorant Garamond",
    body: "Nunito",
    label: "Cormorant Garamond + Nunito",
    mood: "Soft luxury",
    previewHeading: "Refined & Warm",
    previewBody: "Gentle curves, inviting and approachable.",
    googleUrl: "family=Cormorant+Garamond:wght@400;600&family=Nunito:wght@400;500",
  },
];

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
  label,
  sub,
  icon,
  files,
  onFiles,
  accept,
}: {
  label: string;
  sub: string;
  icon: React.ReactNode;
  files: File[];
  onFiles: (f: File[]) => void;
  accept: string;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (dropped.length) onFiles([...files, ...dropped]);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length) onFiles([...files, ...selected]);
  }

  function removeFile(i: number) {
    onFiles(files.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-2 px-6 py-6 rounded-xl cursor-pointer transition-all"
        style={{
          border: `1px dashed ${dragging ? "#06b6d4" : "rgba(255,255,255,0.1)"}`,
          background: dragging ? "rgba(6,182,212,0.1)" : "#0a0a0a",
        }}
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
              <button type="button" onClick={() => removeFile(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: "#ef4444", color: "#fff" }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StylePackCard({ pack, selected, onClick }: { pack: Theme; selected: boolean; onClick: () => void }) {
  const t = pack.tokens;
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-xl overflow-hidden transition-all"
      style={{
        border: selected ? "1px solid #06b6d4" : "1px solid rgba(255,255,255,0.08)",
        boxShadow: selected ? "0 0 0 1px #06b6d4" : "none",
      }}
    >
      {/* Preview */}
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
        <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 1, fontFamily: "var(--font-space-grotesk)" }}>{pack.name}</p>
        <p style={{ fontSize: 11, color: "#71717a" }}>{t.heading_font}</p>
      </div>
      {selected && (
        <div className="flex items-center gap-1 px-3 py-1" style={{ background: "#06b6d4" }}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: 10, fontWeight: 600, color: "#000", fontFamily: "var(--font-dm-mono)" }}>Selected</span>
        </div>
      )}
    </button>
  );
}

function FontCard({ pair, selected, onClick }: { pair: FontPair; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left flex items-center justify-between rounded-xl transition-all"
      style={{
        background: selected ? "rgba(6,182,212,0.1)" : "#0a0a0a",
        border: `1px solid ${selected ? "#06b6d4" : "rgba(255,255,255,0.1)"}`,
        padding: "14px 16px",
      }}
    >
      <div style={{ flex: 1 }}>
        <div className="flex items-center gap-2 mb-1">
          <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: `"${pair.heading}", serif` }}>
            {pair.mood}
          </p>
        </div>
        <p style={{ fontSize: 11, color: "#71717a", fontFamily: "var(--font-dm-mono)" }}>
          {pair.heading} · {pair.body}
        </p>
      </div>
      <div
        style={{
          width: 8, height: 8, borderRadius: "50%",
          background: selected ? "#06b6d4" : "rgba(255,255,255,0.1)",
          boxShadow: selected ? "0 0 6px rgba(6,182,212,0.5)" : "none",
          flexShrink: 0,
          transition: "all 0.2s",
        }}
      />
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VisualDirectionPage() {
  const router = useRouter();
  const { projectId } = useParams<{ projectId: string }>();

  const [project, setProject] = useState<Awaited<ReturnType<typeof getProject>>>(null);
  const [packs, setPacks] = useState<Theme[]>([]);
  const [globalTokens, setGlobalTokens] = useState<Awaited<ReturnType<typeof getGlobalTheme>>>(null);
  const [packsLoading, setPacksLoading] = useState(true);

  // uploads
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [inspirationFiles, setInspirationFiles] = useState<File[]>([]);
  const [referenceUrl, setReferenceUrl] = useState("");
  const [referenceUrls, setReferenceUrls] = useState<string[]>([]);
  const [refFocused, setRefFocused] = useState(false);

  // selections
  const [selectedPack, setSelectedPack] = useState("");
  const [selectedFont, setSelectedFont] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // load Google Fonts
  useEffect(() => {
    const allFonts = FONT_PAIRS.map((p) => p.googleUrl).join("&");
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${allFonts}&display=swap`;
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  useEffect(() => {
    getProject(projectId).then(setProject);
    getGlobalTheme().then(setGlobalTokens);
  }, [projectId]);

  // Load style packs for this project's industry
  useEffect(() => {
    if (!project) return;
    setPacksLoading(true);
    getThemes(project.industry ?? undefined)
      .then(setPacks)
      .catch(() => setPacks([]))
      .finally(() => setPacksLoading(false));
  }, [project?.industry]);

  // Auto-select font from chosen pack
  useEffect(() => {
    if (!selectedPack) return;
    const pack = packs.find((p) => p.name === selectedPack);
    if (!pack) return;
    const h = pack.tokens.heading_font;
    const b = pack.tokens.body_font;
    const match = FONT_PAIRS.find((fp) => fp.heading === h && fp.body === b);
    if (match) setSelectedFont(match.id);
  }, [selectedPack, packs]);

  const isExistingApp = project?.project_type === "existing_app";

  function addReferenceUrl() {
    const url = referenceUrl.trim();
    if (!url) return;
    setReferenceUrls((prev) => [...prev, url]);
    setReferenceUrl("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPack || !selectedFont) {
      setError("Please select a Style Pack and Font Pairing.");
      return;
    }
    setSubmitting(true);
    setError("");

    // Upload files
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

    const fontPair = FONT_PAIRS.find((f) => f.id === selectedFont);
    const chosenPack = packs.find((p) => p.name === selectedPack)!;

    const brain = generateBrain(
      project!,
      chosenPack,
      globalTokens,
      {
        screenshots:        screenshotUrls,
        inspiration_images: inspirationUrls,
        reference_urls:     referenceUrls,
        font_pairing:       fontPair?.label ?? `${chosenPack.tokens.heading_font} + ${chosenPack.tokens.body_font}`,
      }
    );

    try {
      await saveVisualDirection(projectId, {
        style_pack: selectedPack,
        font_pairing: fontPair?.label ?? `${chosenPack.tokens.heading_font} + ${chosenPack.tokens.body_font}`,
        inspiration_images: inspirationUrls,
        reference_urls: referenceUrls,
        brain,
      });
      router.push(`/projects/${projectId}?init=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save. Try again.");
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
        <button onClick={() => router.back()} className="flex items-center gap-1.5 transition-colors" style={{ color: "#71717a", fontFamily: "var(--font-dm-mono)", fontSize: 11, letterSpacing: "0.3px" }}
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
          Upload your app, add inspiration, or let Zeach pick for you.
        </p>

        {project?.industry && (
          <div className="inline-flex items-center gap-1.5 rounded-full mb-6" style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)", padding: "5px 12px", fontFamily: "var(--font-dm-mono)", fontSize: 11, fontWeight: 500, color: "#06b6d4" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {project.industry} styles shown
          </div>
        )}

        <form id="setup-form" onSubmit={handleSubmit} className="flex flex-col" style={{ gap: 28 }}>

          {/* Upload existing */}
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
                <div
                  className="flex flex-col items-center justify-center gap-2 rounded-xl"
                  style={{ border: "1px dashed rgba(255,255,255,0.1)", background: "#0a0a0a", padding: "18px 12px", flex: 1 }}
                >
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
                    <button type="button" onClick={() => setReferenceUrls((p) => p.filter((_, j) => j !== i))} style={{ color: "#3f3f46", fontSize: 14, lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <OrDivider label="or choose a style" />

          {/* Style Packs */}
          <div>
            <SectionLabel>Style Pack</SectionLabel>
            {packsLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {[1,2,3,4].map((i) => (
                  <div key={i} className="rounded-xl animate-pulse" style={{ height: 120, background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }} />
                ))}
              </div>
            ) : packs.length === 0 ? (
              <p style={{ fontSize: 13, color: "#71717a" }}>No themes found. Run migration 004_style_packs.sql in Supabase first.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {packs.map((pack) => (
                  <StylePackCard key={pack.name} pack={pack} selected={selectedPack === pack.name} onClick={() => setSelectedPack(pack.name)} />
                ))}
              </div>
            )}
          </div>

          {/* Font Pairing */}
          <div>
            <SectionLabel>Font Pairing</SectionLabel>
            <div className="flex flex-col gap-2">
              {FONT_PAIRS.map((pair) => (
                <FontCard key={pair.id} pair={pair} selected={selectedFont === pair.id} onClick={() => setSelectedFont(pair.id)} />
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
              border: "none",
              borderRadius: 10,
              padding: 15,
              fontFamily: "var(--font-space-grotesk)",
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "-0.2px",
              cursor: submitting || !canSubmit ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
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
                Building brain…
              </>
            ) : (
              <>
                Generate Project Brain
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
