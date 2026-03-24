"use client";

import { use, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getProjectFiles, upsertProjectFile, type ProjectFile } from "@/lib/db";
import { createClient } from "@/lib/supabase/client";
import { useChat, PersistConfig } from "@/hooks/useChat";
import ChatPanel from "@/components/ChatPanel";
import ProjectPreview from "@/components/ProjectPreview";
import ShareProjectModal from "@/components/ShareProjectModal";
import { useScreenGenerator } from "@/hooks/useScreenGenerator";
import { brainToInputs } from "@/lib/zeach/buildPrompt";
import { INTER_SCREEN_DELAY_MS } from "@/lib/zeach/generateScreen";

const MIN_CHAT_PCT = 20;
const MAX_CHAT_PCT = 80;
const DEFAULT_CHAT_PCT = 45;

// ─── Build initial generation prompt from brain ────────────────────────────────

// Returns the correct screen count range for a complexity level
function complexityScreenRange(complexity: string): { min: number; max: number; label: string } {
  if (complexity === "Startup") return { min: 8, max: 12, label: "8–12 screens" };
  if (complexity === "Scale")   return { min: 15, max: 20, label: "15–20 screens" };
  return { min: 3, max: 3, label: "3 screens" }; // MVP — 3 screens only
}

// Cap for auto-generation per complexity level
function complexityScreenCap(complexity: string): number {
  if (complexity === "Startup") return 8;
  if (complexity === "Scale")   return 15;
  return 3; // MVP
}

// Whether the platforms list indicates a web/desktop app (not mobile-only)
function isWebPlatform(platforms: string[]): boolean {
  return platforms.some((p) => /web|desktop|browser|saas/i.test(p));
}

function buildInitialPrompt(brain: Record<string, unknown>): string {
  const p = (brain.project ?? {}) as Record<string, unknown>;
  const dt = (brain.design_tokens ?? {}) as Record<string, unknown>;
  const colors = (dt.colors ?? {}) as Record<string, string>;
  const typo = (dt.typography ?? {}) as Record<string, unknown>;
  const icons = (brain.icons ?? {}) as Record<string, unknown>;
  const screens = (brain.screens ?? {}) as Record<string, unknown>;
  const stylePack = (brain.style_pack ?? {}) as Record<string, string>;
  const capsules = (brain.capsules ?? {}) as Record<string, boolean>;
  const scaling = (brain.scaling ?? {}) as Record<string, unknown>;

  const name = (p.name as string) ?? "this app";
  const appType = (p.app_type as string) ?? (p.type as string) ?? "";
  const industry = (p.industry as string) ?? "";
  const complexity = (p.complexity as string) ?? "MVP";
  const description = (p.description as string) ?? "";
  const features = Array.isArray(p.features) ? (p.features as string[]) : [];
  const platformRaw = Array.isArray(p.platform) ? (p.platform as string[]) : ["iOS"];
  const platformStr = platformRaw.join(", ");
  const notes = (p.notes as string) ?? "";
  const fullInventory = Array.isArray(screens.inventory) ? (screens.inventory as string[]) : [];
  const tabBar = Array.isArray(screens.tab_bar) ? (screens.tab_bar as string[]) : [];
  const navFlow = (screens.navigation_flow ?? {}) as Record<string, string[]>;
  const baseDevice = (scaling.base_device as string) ?? "iPhone";

  const primary = colors.primary ?? "#000";
  const background = colors.background ?? "#fff";
  const headingFont = (typo.heading_font as string) ?? "Inter";
  const bodyFont = (typo.body_font as string) ?? "DM Sans";
  const iconWeight = (icons.weight as string) ?? "outlined";
  const iconFill = (icons.fill as number) ?? 0;
  const primaryIcons = Array.isArray(icons.primary_icons) ? (icons.primary_icons as string[]).join(", ") : "";
  const packName = stylePack.name ?? "";
  const aesthetic = stylePack.aesthetic ?? "";
  const tone = stylePack.tone ?? "";
  const darkMode = !!capsules.dark_mode;

  // ── Complexity-based screen count ────────────────────────────────────────────
  const range = complexityScreenRange(complexity);
  // Slice the inventory to the max for this complexity; always show at least min
  const screenList = fullInventory.slice(0, range.max);
  // If inventory is too short, pad with default screens until we reach min count
  const minScreens = Math.min(range.min, fullInventory.length || range.min);

  // ── Platform-specific layout mode ────────────────────────────────────────────
  const webMode = isWebPlatform(platformRaw);
  const layoutMode = webMode ? "web" : "mobile";

  // ── Global theme tokens (from DB) ─────────────────────────────────────────────
  const globalTheme = (brain.global_theme ?? {}) as Record<string, unknown>;
  const gtBreakpoints = (globalTheme.breakpoints ?? {}) as Record<string, string>;
  const gtFontSizes = (globalTheme.font_sizes ?? {}) as Record<string, unknown>;
  const gtSpacing = (globalTheme.spacing ?? {}) as Record<string, unknown>;
  const gtLayout = (globalTheme.layout ?? {}) as Record<string, unknown>;

  // Helper: extract a value that may be flat string OR {mobile, tablet, desktop}
  function gtVal(v: unknown, vp: "mobile" | "tablet" | "desktop" = "mobile"): string {
    if (typeof v === "string") return v;
    if (typeof v === "object" && v !== null) {
      const o = v as Record<string, string>;
      return o[vp] ?? o.mobile ?? "";
    }
    return "";
  }

  // Breakpoints — new format uses mobile/tablet/desktop keys
  const bpTablet  = gtBreakpoints.tablet    ?? (scaling.breakpoints as Record<string,string>)?.ipad    ?? "744px";
  const bpDesktop = gtBreakpoints.desktop   ?? (scaling.breakpoints as Record<string,string>)?.ipad_pro ?? "1280px";
  const bpMobile  = gtBreakpoints.mobile_max ?? "430px";

  // Container widths from layout.container_width
  const containerLayout = (gtLayout.container_width ?? {}) as Record<string, string>;
  const containerTablet  = containerLayout.tablet  ?? "720px";
  const containerDesktop = containerLayout.desktop ?? "1200px";

  // Build responsive font-size CSS variables
  const responsiveFontVars = Object.entries(gtFontSizes).map(([k, v]) => {
    const m = gtVal(v, "mobile");
    const t = gtVal(v, "tablet");
    const d = gtVal(v, "desktop");
    return m ? `  --fs-${k}: ${m}; /* tablet:${t} desktop:${d} */` : "";
  }).filter(Boolean).join("\n");

  // Build responsive spacing CSS variables (mobile base)
  const responsiveSpacingVars = Object.entries(gtSpacing).map(([k, v]) => {
    const m = gtVal(v, "mobile");
    return m ? `  --sp-${k}: ${m};` : "";
  }).filter(Boolean).join("\n");

  const navFlowLines = Object.entries(navFlow)
    .slice(0, 6)
    .map(([from, to]) => `  ${from} → ${to.join(", ")}`)
    .join("\n");

  // CSS variables from brain design tokens
  const cssTokens = Object.entries(colors)
    .map(([k, v]) => `  --color-${k.replace(/_/g, "-")}: ${v};`)
    .join("\n");

  const googleFontsUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(headingFont)}:wght@400;600;700&family=${encodeURIComponent(bodyFont)}:wght@400;500;600&display=swap`;
  const iconsFontUrl = `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,${iconFill},-50..200`;

  // ── Responsive layout rules (always 3-breakpoint CSS, regardless of platform) ──
  const responsiveRules = webMode ? `
## Layout — Web/Desktop responsive (breakpoints from global_theme)
- Mobile: 0 – ${bpTablet}  |  Tablet: ${bpTablet} – ${bpDesktop}  |  Desktop: ≥ ${bpDesktop}
- Container max-width: tablet=${containerTablet}, desktop=${containerDesktop}

CSS structure to use in EVERY page:
  body { margin:0; background:var(--color-background); }
  .layout { display:flex; min-height:100vh; }
  .sidebar { display:none; width:0; flex-shrink:0; overflow:hidden; }
  .main { flex:1; min-width:0; }
  .container { width:100%; padding:0 16px; }
  .card-grid { display:grid; grid-template-columns:1fr; gap:16px; }

  @media (min-width: ${bpTablet}) {
    .sidebar { display:flex; flex-direction:column; width:220px; }
    .container { max-width:${containerTablet}; margin:0 auto; padding:0 24px; }
    .card-grid { grid-template-columns:repeat(2,1fr); }
  }
  @media (min-width: ${bpDesktop}) {
    .sidebar { width:260px; }
    .container { max-width:${containerDesktop}; padding:0 32px; }
    .card-grid { grid-template-columns:repeat(3,1fr); }
  }` : `
## Layout — Mobile app (${baseDevice}) — MUST produce THREE distinct layouts
- Mobile (0 – ${bpTablet}): centered phone shell, max-width ${bpMobile}
- Tablet (${bpTablet} – ${bpDesktop}): wider centered shell with border-radius + shadow
- Desktop (≥ ${bpDesktop}): FULL WEB LAYOUT — sidebar navigation, no shell centering

Use this EXACT CSS in EVERY page (copy verbatim, then add your own styles):

  /* ── Mobile ── */
  body { margin:0; min-height:100vh; background:#e0e0e0; display:flex; justify-content:center; align-items:flex-start; }
  .app-shell { width:100%; max-width:${bpMobile}; min-height:100vh; background:var(--color-background); display:flex; flex-direction:column; position:relative; }
  .scroll-area { flex:1; overflow-y:auto; padding-bottom:80px; }
  .desktop-sidebar { display:none; }
  .card-grid { display:grid; grid-template-columns:1fr; gap:12px; }

  /* ── Tablet ── */
  @media (min-width: ${bpTablet}) {
    body { padding:32px 0; align-items:center; background:#c8c8c8; }
    .app-shell { max-width:768px; border-radius:24px; overflow:hidden; box-shadow:0 32px 80px rgba(0,0,0,0.25); }
    .card-grid { grid-template-columns:repeat(2,1fr); gap:16px; }
    h1 { font-size:${gtVal(gtFontSizes.h1, "tablet") || "32px"} !important; }
  }

  /* ── Desktop: transforms into a real web app ── */
  @media (min-width: ${bpDesktop}) {
    body { padding:0; background:var(--color-background); align-items:stretch; justify-content:flex-start; }
    .app-shell { max-width:none; border-radius:0; box-shadow:none; flex-direction:row; width:100vw; }
    .scroll-area { padding-bottom:0; }
    .app-header { display:none !important; }   /* hide mobile top bar */
    .app-tabbar { display:none !important; }   /* hide mobile bottom tab bar */
    .desktop-sidebar {
      display:flex; flex-direction:column;
      width:260px; min-height:100vh; flex-shrink:0;
      background:var(--color-surface); border-right:1px solid var(--color-border);
      padding:24px 0; position:sticky; top:0; overflow-y:auto;
    }
    .main-content { flex:1; min-width:0; overflow-y:auto; padding:${gtVal(gtSpacing.screen, "desktop") || "32px"}; }
    .card-grid { grid-template-columns:repeat(3,1fr); gap:20px; }
    h1 { font-size:${gtVal(gtFontSizes.h1, "desktop") || "40px"} !important; }
    h2 { font-size:${gtVal(gtFontSizes.h2, "desktop") || "32px"} !important; }
  }

EVERY screen MUST include BOTH navigation elements — they show at different breakpoints:
1. Mobile chrome: <div class="app-header"> (56px top bar) + <div class="app-tabbar"> (80px bottom tabs) — hidden at desktop
2. Desktop chrome: <div class="desktop-sidebar"> with logo + nav links — hidden on mobile/tablet, shown at desktop (${bpDesktop}+)
Wrap the scrollable page body in <div class="scroll-area"><div class="main-content">…</div></div>`;

  // Final :root block includes both color tokens AND responsive font/spacing vars
  const rootBlock = `${cssTokens}${responsiveFontVars ? "\n" + responsiveFontVars : ""}${responsiveSpacingVars ? "\n" + responsiveSpacingVars : ""}`;

  return `Build the **${name}** app.

## ── STEP 1: VALIDATE (write this first, NO files yet) ───────────────────────
Before writing any code, run this analysis from "Describe your idea" and "Additional Notes" ONLY:

**A. Core entities** (what objects/data does the app manage?): [extract from idea+notes]
**B. Required features** (what can the user do?): [extract from idea+notes only — no extras]
**C. Required flows** (what paths through the app are needed?): [extract from idea+notes only]
**D. Required screens** (one per distinct view in the flows above — justify each):
  - Screen name → "Required because: [quote from idea or notes]"
  - (remove any screen you cannot justify this way)

Then confirm:
✓ Platform: ${platformStr} → layout mode: **${layoutMode}**
✓ Complexity: **${complexity}** → target **${range.label}** screens (only if justified by the idea)
✓ Dark mode: ${darkMode ? "YES — dark backgrounds" : "NO — light backgrounds"}
✓ Primary colour: ${primary} | Background: ${background}
✓ Fonts confirmed: heading=${headingFont}, body=${bodyFont}
✓ Industry/App Type used for: VISUAL STYLE ONLY (not features, not screens)

## ── STEP 2: GENERATE (immediately after the checklist) ──────────────────────
Output files in this exact order — NO backtick fences, NO extra text between markers:

1. styles/global.css — ALL shared CSS: :root tokens, reset, typography, layout, components, animations
2. scripts/main.js  — ALL shared JS: navigation interception, active states, micro-interactions
3. pages/*.html     — Every screen (${range.label}), each importing the above two files

File format (copy exactly):
--- FILE: styles/global.css ---
/* all shared CSS here */

--- FILE: scripts/main.js ---
// all shared JS here

--- FILE: pages/home.html ---
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Home — ${name}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="${googleFontsUrl}">
  <link rel="stylesheet" href="${iconsFontUrl}">
  <link rel="stylesheet" href="../styles/global.css">
</head>
<body>
  <!-- page-specific markup only — no repeated CSS -->
  <script src="../scripts/main.js"></script>
</body>
</html>

--- FILE: pages/next_screen.html ---
...and so on for all screens

## Project context — PRIORITY ORDER (highest first)

### ① DESCRIBE YOUR IDEA — PRIMARY SOURCE (features, screens, flows come from HERE only)
${description || "N/A"}

### ② ADDITIONAL NOTES — SECONDARY SOURCE (extra constraints, additions, overrides)
${notes || "None"}

### ③ VISUAL STYLE ONLY (do NOT derive features from these)
- App Type: **${appType}**${industry ? ` · Industry: ${industry}` : ""} → used for aesthetics, UX patterns, icons only
- Platform: **${platformStr}** (base: ${baseDevice})
- Complexity: **${complexity}** → target **${range.label}** screens — but only generate screens justified by ① and ②
- Feature chips selected: ${features.length ? features.join(", ") : "none"} → only act on these if ① or ② also mention them

## Design system — use EXACTLY these values
- Style: **${packName}** — ${aesthetic}
- Tone: ${tone}
- Dark mode: **${darkMode ? "YES — dark bg everywhere" : "NO — light bg everywhere"}** (bg: ${background}, primary: ${primary})
- Heading font: **${headingFont}** | Body font: **${bodyFont}**
- Icons: **Material Symbols ${iconWeight}** (fill=${iconFill}) — priority icons: ${primaryIcons}
${responsiveRules}

## global.css must define (in :root)
\`\`\`css
:root {
${rootBlock}
}
\`\`\`
Plus: reset (*, body), typography classes (.h1–.h4, .body, .caption, .label), layout helpers (.app-shell, .scroll-area, .main-content, .desktop-sidebar, .app-header, .app-tabbar, .card-grid), animation keyframes (fade-in, slide-up, skeleton-pulse), and all button/card/chip hover states.

## Tab bar
Tabs: **${tabBar.join(" | ")}**

## Navigation flow
${navFlowLines || "  home → detail → profile"}

## Suggested screens (from project brain — only include if justified by ① and ②)
${screenList.map((s, i) => `${i + 1}. ${s}`).join("\n")}
⚠ You may replace or skip any of these if they are not required by the idea/notes. You may add screens not listed here if the idea/notes require them.

## Per-screen rules (NON-NEGOTIABLE)
1. **Import shared files** — link global.css + script main.js; NO inline :root or repeated CSS
2. **Page-specific styles only** — only write <style> blocks for layout unique to that screen
3. **Material Symbols** — NEVER emoji; always <span class="material-symbols-outlined">icon_name</span>
4. **Realistic content** — real data matching the idea: names, prices, ratings, images via unsplash.com/photos
5. **Interactions** — hover + active (scale 0.97) on every button; active tab highlighted; card hover lift
6. **Navigation** — tab bar links: <a href="/screen_name"> matching filenames (no .html extension)
7. **Touch targets** — min 44×44px on all interactive elements
8. **Dual nav** — EVERY screen has BOTH .app-tabbar (mobile) AND .desktop-sidebar (desktop); shown via CSS breakpoints
9. **No filler** — no grey boxes, no "TODO", no "Lorem ipsum" — real content only
10. **No feature creep** — if a screen or feature is not in ① or ②, do NOT include it`.trim();
}

// ─── ChatWorkspace ─────────────────────────────────────────────────────────────

function ChatWorkspace({
  persist,
  projectName,
  files,
  pagesLoading,
  autoInit,
  onBack,
}: {
  persist: PersistConfig;
  projectName: string;
  files: ProjectFile[];
  pagesLoading: boolean;
  autoInit: boolean;
  onBack: () => void;
}) {
  const { messages, isStreaming, isThinking, isLoading, lastUsage, sendMessage, stopStreaming, clearMessages, deletePages } =
    useChat(persist);
  const [chatPct, setChatPct] = useState(DEFAULT_CHAT_PCT);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const didAutoInit = useRef(false);

  // ── New screen generator (replaces the old streaming artifact flow) ───────────
  const { html: genHtml, isLoading: genLoading, error: genError, generate } = useScreenGenerator();
  const [genQueue, setGenQueue] = useState<string[]>([]);
  const [genActive, setGenActive] = useState<string | null>(null);
  const [firstScreenReady, setFirstScreenReady] = useState(false);
  // Local copy of files we can extend with freshly generated ones
  const [generatedFiles, setGeneratedFiles] = useState<ProjectFile[]>(files);

  // Keep generatedFiles in sync when parent files prop changes (e.g. initial DB load)
  useEffect(() => {
    setGeneratedFiles(files);
  }, [files]);

  // Advance the queue — called on success OR error so a bad screen never stalls everything
  const advanceQueue = useCallback(() => {
    setGenQueue((prev) => {
      const [next, ...rest] = prev;
      if (next && persist.brain) {
        const brain = persist.brain;
        setGenActive(next);
        setTimeout(() => generate(brainToInputs(brain, next)), INTER_SCREEN_DELAY_MS);
        return rest;
      }
      setGenActive(null);
      return [];
    });
  }, [persist.brain, generate]);

  // When a screen finishes successfully — save and show immediately
  useEffect(() => {
    if (!genHtml || genLoading || !genActive || !persist.projectId || !persist.userId) return;

    const filePath = `pages/${genActive}.html`;
    const newFile: ProjectFile = {
      id: filePath,
      project_id: persist.projectId,
      user_id: persist.userId!,
      file_path: filePath,
      content: genHtml,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Update local preview immediately so the screen appears right away
    setGeneratedFiles((prev) => [...prev.filter((f) => f.file_path !== filePath), newFile]);
    persist.onFilesUpdate?.([newFile]);

    // Mark first screen ready so preview auto-selects it
    if (!firstScreenReady) setFirstScreenReady(true);

    // Persist to DB (fire-and-forget)
    upsertProjectFile(persist.projectId, persist.userId!, filePath, genHtml).catch(
      (err) => console.error("[upsertProjectFile]", err)
    );

    advanceQueue();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genHtml, genLoading]);

  // When a screen errors — log and continue to the next one so the queue never stalls
  useEffect(() => {
    if (!genError || genLoading || !genActive) return;
    console.error(`[generate-screen] "${genActive}" failed:`, genError);
    advanceQueue();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genError, genLoading]);

  // ── Auto-generate all screens on first visit ──────────────────────────────────
  useEffect(() => {
    if (
      !autoInit ||
      didAutoInit.current ||
      pagesLoading ||
      generatedFiles.length > 0 ||
      !persist.brain
    ) return;

    didAutoInit.current = true;

    const allScreens = (
      (persist.brain.screens as Record<string, unknown>)?.inventory as string[]
    ) ?? [];

    if (allScreens.length === 0) return;

    const complexity = (
      (persist.brain.project as Record<string, unknown>)?.complexity as string
    ) ?? "MVP";

    // Limit the number of screens generated based on complexity
    const cap = complexityScreenCap(complexity);
    const screens = allScreens.slice(0, cap);

    const [first, ...rest] = screens;
    setFirstScreenReady(false); // reset so loading state shows for this new run
    setGenQueue(rest);
    setGenActive(first);
    generate(brainToInputs(persist.brain, first));
  }, [autoInit, pagesLoading, generatedFiles.length, persist.brain, generate]);

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
          isThinking={isThinking}
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
          files={generatedFiles}
          // Only block the full preview while waiting for the very first screen.
          // Once screen 1 is ready, keep showing it while subsequent screens
          // generate in the background.
          pagesLoading={pagesLoading || (genLoading && !firstScreenReady)}
          messages={messages}
          isStreaming={isStreaming || (genLoading && !firstScreenReady)}
          isThinking={isThinking || (genLoading && !!genActive && !firstScreenReady)}
          // Show a subtle badge when screens are still being generated in the bg
          isGeneratingBackground={genLoading && firstScreenReady}
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
  const searchParams = useSearchParams();
  const autoInit = searchParams.get("init") === "1";

  const [projectName, setProjectName] = useState("Project");
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [brain, setBrain] = useState<Record<string, unknown> | null>(null);

  // Load project name + brain from DB
  useEffect(() => {
    if (!user) return;
    const cached = sessionStorage.getItem(`project_name_${projectId}`);
    if (cached) setProjectName(cached);

    const supabase = createClient();
    (async () => {
      try {
        const { data } = await supabase
          .from("projects")
          .select("name, brain")
          .eq("id", projectId)
          .single();
        if (data?.name) {
          setProjectName(data.name);
          sessionStorage.setItem(`project_name_${projectId}`, data.name);
        }
        if (data?.brain) {
          setBrain(data.brain as Record<string, unknown>);
        }
      } catch {
        // non-critical
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
        brain,
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
          autoInit={autoInit}
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
