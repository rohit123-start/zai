"use client";

import { use, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getProjectFiles, type ProjectFile } from "@/lib/db";
import { createClient } from "@/lib/supabase/client";
import { useChat, PersistConfig } from "@/hooks/useChat";
import ChatPanel from "@/components/ChatPanel";
import ProjectPreview from "@/components/ProjectPreview";
import ShareProjectModal from "@/components/ShareProjectModal";

const MIN_CHAT_PCT = 20;
const MAX_CHAT_PCT = 80;
const DEFAULT_CHAT_PCT = 45;

// ─── Build initial generation prompt from brain ────────────────────────────────

// Returns the correct screen count range for a complexity level
function complexityScreenRange(complexity: string): { min: number; max: number; label: string } {
  if (complexity === "Startup") return { min: 12, max: 15, label: "12–15 screens" };
  if (complexity === "Scale")   return { min: 20, max: 30, label: "20+ screens" };
  return { min: 8, max: 10, label: "8–10 screens" }; // MVP default
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
    --fs-h1: ${gtVal(gtFontSizes.h1, "tablet") || "32px"};
    --sp-screen: ${gtVal(gtSpacing.screen, "tablet") || "24px"};
  }
  @media (min-width: ${bpDesktop}) {
    .sidebar { width:260px; }
    .container { max-width:${containerDesktop}; padding:0 32px; }
    .card-grid { grid-template-columns:repeat(3,1fr); }
    --fs-h1: ${gtVal(gtFontSizes.h1, "desktop") || "40px"};
    --sp-screen: ${gtVal(gtSpacing.screen, "desktop") || "32px"};
  }` : `
## Layout — Mobile app (${baseDevice}) — MUST work at ALL viewport widths
- Mobile: 0 – ${bpTablet}  |  Tablet: ${bpTablet}  |  Desktop: ${bpDesktop}

Use this EXACT CSS wrapper in every page:
  body { margin:0; min-height:100vh; background:#dedede; display:flex; justify-content:center; align-items:flex-start; }
  .app-shell { width:100%; max-width:${bpMobile}; min-height:100vh; background:var(--color-background); display:flex; flex-direction:column; position:relative; }
  .scroll-area { flex:1; overflow-y:auto; padding-bottom:80px; }
  .card-grid { display:grid; grid-template-columns:1fr; gap:12px; }

  @media (min-width: ${bpTablet}) {
    body { align-items:center; padding:32px 0; background:#c8c8c8; }
    .app-shell { max-width:768px; min-height:90vh; border-radius:24px; overflow:hidden; box-shadow:0 32px 80px rgba(0,0,0,0.25); }
    .card-grid { grid-template-columns:repeat(2,1fr); gap:16px; }
    /* Responsive font sizes at tablet */
    h1 { font-size:${gtVal(gtFontSizes.h1, "tablet") || "32px"} !important; }
    h2 { font-size:${gtVal(gtFontSizes.h2, "tablet") || "26px"} !important; }
  }
  @media (min-width: ${bpDesktop}) {
    .app-shell { max-width:1024px; }
    .card-grid { grid-template-columns:repeat(3,1fr); gap:20px; }
    /* Responsive font sizes at desktop */
    h1 { font-size:${gtVal(gtFontSizes.h1, "desktop") || "40px"} !important; }
    h2 { font-size:${gtVal(gtFontSizes.h2, "desktop") || "32px"} !important; }
  }

- Status bar (44px fixed top) + bottom tab bar (80px fixed bottom)
- Scrollable content sits between them in .scroll-area`;

  // Final :root block includes both color tokens AND responsive font/spacing vars
  const rootBlock = `${cssTokens}${responsiveFontVars ? "\n" + responsiveFontVars : ""}${responsiveSpacingVars ? "\n" + responsiveSpacingVars : ""}`;

  return `Build the **${name}** app.

## ── STEP 1: PLAN (write this first, NO files yet) ─────────────────────────────
State what you will build in a brief plan:
• App: ${name} (${appType}${industry ? `, ${industry}` : ""})
• Complexity: ${complexity} → **${range.label}** (you MUST generate at least ${minScreens} files)
• List every screen you will output, numbered, with one-line description
• State the layout mode: ${layoutMode}

## ── STEP 2: GENERATE (immediately after the plan) ───────────────────────────
Output EVERY screen as a separate file — one right after the other.
Use EXACTLY this format (no backtick fences, no extra text between files):

--- FILE: pages/screen_name.html ---
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Screen Name — ${name}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="stylesheet" href="${googleFontsUrl}">
    <link rel="stylesheet" href="${iconsFontUrl}">
    <style>
      :root {
${rootBlock}
      }
      /* mobile-first responsive layout + media queries here */
    </style>
  </head>
  <body>...</body>
</html>

## Project context
- App name: **${name}**
- Type: **${appType}**${industry ? ` · ${industry}` : ""}
- Description: ${description || "N/A"}
- Platform: **${platformStr}** (base: ${baseDevice})
- Complexity: **${complexity}** → must generate **at least ${minScreens} screens**, up to ${range.max}
- Features: ${features.length ? features.join(", ") : "none specified"}
${notes ? `- Notes: ${notes}` : ""}

## Design system — use EXACTLY
- Style: **${packName}** — ${aesthetic}
- Tone: ${tone}
- Dark mode: **${darkMode ? "YES" : "NO"}** (bg: ${background}, primary: ${primary})
- Heading font: **${headingFont}** | Body font: **${bodyFont}**
- Icons: **Material Symbols ${iconWeight}** (fill=${iconFill}) — use: ${primaryIcons}
${responsiveRules}

## Tab bar
Tabs: **${tabBar.join(" | ")}**

## Navigation flow
${navFlowLines || "  home → detail → profile"}

## Screens to generate — MUST build ALL of these (${range.label})
${screenList.map((s, i) => `${i + 1}. ${s}`).join("\n")}

## Per-screen requirements (NON-NEGOTIABLE)
1. **Standalone HTML** — all CSS inline in <style>, fonts from CDN only
2. **CSS variables** — define :root{} with ALL tokens, use var(--color-*) everywhere
3. **Material Symbols** — NEVER emoji, NEVER Unicode symbols; always <span class="material-symbols-outlined">name</span>
4. **Realistic content** — real ${industry || appType} data (names, prices, ratings, descriptions); zero grey placeholder boxes
5. **Interactions** — hover/active states on every button (scale 0.97), tab bar active colour, card hover lift
6. **Navigation links** — tab bar items: <a href="/screen_name"> matching file names
7. **Touch targets** — min 44px height on all interactive elements
8. **No comments** between files — output --- FILE: --- markers back to back`.trim();
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
  const { messages, isStreaming, isLoading, lastUsage, sendMessage, stopStreaming, clearMessages, deletePages } =
    useChat(persist);
  const [chatPct, setChatPct] = useState(DEFAULT_CHAT_PCT);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const didAutoInit = useRef(false);

  // ── Derive expected screen count from brain ───────────────────────────────────
  const expectedScreenCount = useMemo(() => {
    if (!persist.brain) return 0;
    const brainScreens = (persist.brain.screens ?? {}) as Record<string, unknown>;
    const inventory = Array.isArray(brainScreens.inventory) ? brainScreens.inventory.length : 0;
    const c = ((persist.brain.project ?? {}) as Record<string, unknown>).complexity as string ?? "MVP";
    const max = c === "MVP" ? 10 : c === "Startup" ? 15 : 30;
    return Math.min(inventory, max);
  }, [persist.brain]);

  // ── Auto-generate initial screens on first visit ──────────────────────────────
  useEffect(() => {
    if (
      !autoInit ||
      didAutoInit.current ||
      isLoading ||
      pagesLoading ||
      isStreaming ||
      files.length > 0 ||
      messages.length > 0 ||
      !persist.brain
    ) return;

    didAutoInit.current = true;
    const prompt = buildInitialPrompt(persist.brain);
    sendMessage(prompt, [], { silent: true });
  }, [autoInit, isLoading, pagesLoading, isStreaming, files.length, messages.length, persist.brain, sendMessage]);

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
          files={files}
          pagesLoading={pagesLoading}
          messages={messages}
          isStreaming={isStreaming}
          fullscreen={previewFullscreen}
          onToggleFullscreen={() => setPreviewFullscreen((v) => !v)}
          expectedScreenCount={autoInit ? expectedScreenCount : 0}
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
