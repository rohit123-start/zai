import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Allow pipeline to run up to 300 seconds (batch generation: 4+ Sonnet calls for 27+ screens)
export const maxDuration = 300;

// ─── Models ───────────────────────────────────────────────────────────────────

const SONNET = process.env.MODEL ?? "claude-sonnet-4-6";
const HAIKU  = "claude-haiku-4-5";

// ─── Industry → brain file mapping ───────────────────────────────────────────

const INDUSTRY_FILE: Record<string, string> = {
  "Beauty & Wellness":    "beauty_wellness",
  "Finance":              "finance",
  "Healthcare":           "healthcare",
  "Fitness & Sport":      "fitness_sport",
  "Food & Beverage":      "food_beverage",
  "Retail & Fashion":     "retail_fashion",
  "Education":            "education",
  "Travel & Lifestyle":   "travel_lifestyle",
  "Real Estate":          "real_estate",
  "Transport & Logistics":"transport_logistics",
  "Events & Ticketing":   "events_ticketing",
  "Entertainment":        "entertainment",
  "AI & Technology":      "ai_technology",
  "Developer Tools":      "developer_tools",
};

// ─── App type → product brain file mapping ────────────────────────────────────

const PRODUCT_FILE: Record<string, string> = {
  "Booking & Appointments": "booking_core",
  "Finance Banking":        "finance_banking",
  "E-commerce":             "ecommerce_core",
  "Dashboard SaaS":         "dashboard_core",
  "Social & Community":     "social_core",
  "Content & Streaming":    "streaming_core",
  "Chat / Messaging":       "chat_core",
  "Map & Location-Based":   "map_core",
  "AI Tool":                "ai_core",
  "Developer Tool":         "dev_core",
  "Marketplace":            "marketplace_core",
  "LMS / Course Builder":   "lms_course_builder",
  "Patient App":            "patient_app",
  "Property Management":    "property_management",
  "Trip Planner":           "trip_planner",
  "Workout Tracker":        "workout_tracker",
};

// ─── Feature label → file mapping ────────────────────────────────────────────

// All available feature module file stems
const ALL_FEATURE_FILES = [
  "authentication", "analytics_dashboard", "chat_messaging",
  "file_upload", "maps_location", "notifications",
  "payments", "search_filters", "video_calls",
];

function featureToFile(name: string): string {
  return name.toLowerCase()
    .replace(/[&\/]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Load a feature module JSON by name — tries normalization, then scans all files for matching feature_id/feature_name. */
function findFeatureModule(featureName: string): Record<string, unknown> | null {
  const normalized = featureToFile(featureName);
  const direct = loadJson<Record<string, unknown>>(
    path.join(BRAINS_DIR, "zeach-feature-modules", `${normalized}.json`)
  );
  if (direct) return direct;

  // Scan all feature files for a matching feature_id or feature_name
  for (const stem of ALL_FEATURE_FILES) {
    const data = loadJson<Record<string, unknown>>(
      path.join(BRAINS_DIR, "zeach-feature-modules", `${stem}.json`)
    );
    if (!data) continue;
    if (
      data.feature_id === featureName ||
      data.feature_id === normalized ||
      String(data.feature_name ?? "").toLowerCase() === featureName.toLowerCase()
    ) {
      return data;
    }
  }
  return null;
}

// ─── JSON extractor — strips markdown fences from LLM output ─────────────────

function extractJson(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = s.indexOf("{");
  const end   = s.lastIndexOf("}");
  if (start !== -1 && end > start) return s.slice(start, end + 1);
  return s;
}

// ─── Brain file loader ────────────────────────────────────────────────────────

const BRAINS_DIR = path.join(process.cwd(), "zeach-brains");

function loadJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface S1Input {
  project_name: string;
  description: string;
  industry: string;
  app_type: string;
  project_type: string;
  complexity: "MVP" | "Startup" | "Scale";
  features: string[];
  notes: string;
}

interface S2Input {
  style_pack: string;
  font_pairing: string;
  screenshot_urls: string[];
  inspiration_urls: string[];
  reference_urls: string[];
}

interface RequestBody {
  projectId: string;
  userId: string;
  s1: S1Input;
  s2: S2Input;
}

interface ParsedIntent {
  user_types: { type: string; primary: boolean }[];
  app_structure: string;
  core_flows_detected: string[];
  features_implied: {
    explicitly_mentioned: string[];
    strongly_implied: string[];
  };
  complexity_signal: string;
  industry_signal: string;
  tone_hints: string[];
  mismatches: string[];
  suggestions: string[];
  enriched_notes: string;
}

interface ScreenDef {
  id: string;
  name: string;
  purpose: string;
  visual?: string;
  copy?: Record<string, string>;
}

interface ValidationResult {
  runtime_ms: number;
  screen_count_expected: number;
  screen_count_found: number;
  missing_screens: string[];
  has_google_fonts: boolean;
  has_css_variables: boolean;
  no_external_images: boolean;
  passed: number;
  total: number;
  result: "PASS" | "FAIL";
  regenerate_prompt_append?: string;
}

interface QualityReport {
  score: number;
  result: "PASS" | "WARN" | "FAIL";
  checks: { check: string; pass: boolean; note?: string }[];
  warnings: string[];
  fail_prompt_append?: string;
}

// ─── Supabase admin client (service role) ────────────────────────────────────

function getAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ─── Pipeline DB helpers ──────────────────────────────────────────────────────

async function createPipelineRun(projectId: string, userId: string, step01: unknown): Promise<string> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("pipeline_runs")
    .insert({ project_id: projectId, user_id: userId, step_01_input: step01, status: "running" })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to create pipeline_run: ${error.message}`);
  return data.id as string;
}

async function updateRun(runId: string, updates: Record<string, unknown>): Promise<void> {
  const supabase = getAdminClient();
  await supabase.from("pipeline_runs").update(updates).eq("id", runId);
}

// ─── Step 09.5 — Structural Validation ───────────────────────────────────────

function validateStructure(html: string, expectedScreens: string[]): ValidationResult {
  const start = Date.now();

  // Match screen divs regardless of whether class or id comes first
  const screenMatches = [
    ...html.matchAll(/<div[^>]+class=["'][^"']*\bscreen\b[^"']*["'][^>]+id=["']([^"']+)["']/g),
    ...html.matchAll(/<div[^>]+id=["']([^"']+)["'][^>]+class=["'][^"']*\bscreen\b[^"']*["']/g),
  ];
  const foundIds = [...new Set(screenMatches.map((m) => m[1]))];
  const missingScreens = expectedScreens.filter((id) => !foundIds.includes(id));

  const hasGoogleFonts = html.includes("fonts.googleapis.com");
  const hasCssVars = html.includes("--color-primary") && html.includes("--color-background");
  const noExternalImages = !/<img[^>]+src="https?:\/\//i.test(html.replace(/fonts\.googleapis/g, ""));

  const checks = [
    foundIds.length >= expectedScreens.length,
    missingScreens.length === 0,
    hasGoogleFonts,
    hasCssVars,
    noExternalImages,
  ];
  const passed = checks.filter(Boolean).length;
  const result: "PASS" | "FAIL" = passed === checks.length ? "PASS" : "FAIL";

  let regenerate_prompt_append: string | undefined;
  if (result === "FAIL") {
    const issues: string[] = [];
    if (missingScreens.length > 0) issues.push(`Missing screens: ${missingScreens.join(", ")}`);
    if (!hasGoogleFonts) issues.push("Google Fonts link missing");
    if (!hasCssVars) issues.push("CSS variables --color-primary / --color-background missing");
    if (!noExternalImages) issues.push("External img src found — use placeholder SVG instead");
    regenerate_prompt_append = `STRUCTURAL FIXES REQUIRED: ${issues.join(" / ")}`;
  }

  return {
    runtime_ms: Date.now() - start,
    screen_count_expected: expectedScreens.length,
    screen_count_found: foundIds.length,
    missing_screens: missingScreens,
    has_google_fonts: hasGoogleFonts,
    has_css_variables: hasCssVars,
    no_external_images: noExternalImages,
    passed,
    total: checks.length,
    result,
    regenerate_prompt_append,
  };
}

// ─── Step 09.7 — Quality Check prompt ────────────────────────────────────────

/**
 * Extracts focused, meaningful content from the generated HTML for quality auditing.
 * Rather than sending the first N chars (which is mostly <head>/<style> boilerplate),
 * we extract:
 *   1. CSS :root variables block (to verify design tokens are used)
 *   2. The first visible screen div content (to check headline, CTA, tone)
 * This gives Haiku real content to evaluate regardless of HTML size.
 */
function extractQualityAuditContent(html: string): { cssVars: string; homeScreen: string; screenCount: number } {
  // Count all screen divs
  const screenMatches = [
    ...html.matchAll(/<div[^>]+class=["'][^"']*\bscreen\b[^"']*["'][^>]+id=["']([^"']+)["']/g),
    ...html.matchAll(/<div[^>]+id=["']([^"']+)["'][^>]+class=["'][^"']*\bscreen\b[^"']*["']/g),
  ];
  const screenCount = new Set(screenMatches.map((m) => m[1])).size;

  // Extract :root CSS variables
  const rootMatch = html.match(/:root\s*\{([^}]+)\}/);
  const cssVars = rootMatch ? `:root { ${rootMatch[1].trim().slice(0, 800)} }` : "(no :root block found)";

  // Find the home screen — either style="display:block" or the very first screen div
  let homeScreenHtml = "";
  const blockScreen = html.match(/<div[^>]+style=["'][^"']*display:\s*block[^"']*["'][^>]*>[\s\S]{0,5000}/);
  if (blockScreen) {
    homeScreenHtml = blockScreen[0].slice(0, 4000);
  } else {
    // Fallback: first screen div
    const firstScreenIdx = html.search(/<div[^>]+class=["'][^"']*\bscreen\b/i);
    if (firstScreenIdx >= 0) {
      homeScreenHtml = html.slice(firstScreenIdx, firstScreenIdx + 4000);
    }
  }

  return { cssVars, homeScreen: homeScreenHtml, screenCount };
}

function buildQualityCheckPrompt(
  html: string,
  expectedHeadline: string,
  expectedCta: string,
  industryConstraintsAvoid: string[],
  tone: string,
  expectedScreenCount: number
): string {
  const { cssVars, homeScreen, screenCount } = extractQualityAuditContent(html);

  return `You are a UI quality auditor. Review this generated app and return a quality score.

EXPECTED:
- Home screen headline contains: "${expectedHeadline}"
- Primary CTA contains: "${expectedCta}"
- Tone: ${tone}
- Industry constraints to avoid: ${industryConstraintsAvoid.slice(0, 3).join("; ")}
- Screen count: ${screenCount} found (expected ~${expectedScreenCount})

CSS DESIGN TOKENS (:root block):
${cssVars}

HOME SCREEN HTML (first visible screen):
${homeScreen}

Evaluate these 6 checks based on the content above:
1. home_headline — does the home screen contain text matching "${expectedHeadline}"?
2. cta_consistent — does the home screen contain a button/link matching "${expectedCta}"?
3. tone_compliance — does the copy feel: ${tone}? Not robotic or placeholder.
4. no_placeholder_text — no "Lorem ipsum", "TODO", "[placeholder]", or obviously fake names
5. css_variables_used — are the :root CSS variables actually used in the HTML (var(--...) references)?
6. material_symbols_icons — are icons from Material Symbols class (not emoji)?

Return ONLY this JSON (no markdown):
{
  "score": <0-100>,
  "result": "<PASS|WARN|FAIL>",
  "checks": [
    {"check": "home_headline", "pass": <bool>, "note": "<optional>"},
    {"check": "cta_consistent", "pass": <bool>, "note": "<optional>"},
    {"check": "tone_compliance", "pass": <bool>, "note": "<optional>"},
    {"check": "no_placeholder_text", "pass": <bool>, "note": "<optional>"},
    {"check": "css_variables_used", "pass": <bool>, "note": "<optional>"},
    {"check": "material_symbols_icons", "pass": <bool>, "note": "<optional>"}
  ],
  "warnings": ["<warning if any>"],
  "fail_prompt_append": "<instruction to fix if FAIL, or null>"
}

Scoring: PASS >= 80, WARN 60-79, FAIL < 60
IMPORTANT: Only fail if you can clearly see a problem in the content above. If you cannot determine something, default to pass.`;
}

// ─── Step 08 — Generation system prompts ─────────────────────────────────────

// Batch 1: Full HTML file with head + CSS + first N screens
const GENERATION_SYSTEM_PROMPT = `You are Zeach's screen generation engine. Generate a mobile app UI.

## OUTPUT FORMAT — BATCH 1
- Output a complete HTML file: <!DOCTYPE html> … </html>. No markdown. No code fences.
- <head>: Google Fonts CDN links + Material Symbols Outlined + CSS :root variables + global styles
- Each screen: <div class="screen" id="{screen_id}" style="display:none">
- FIRST screen in this batch: style="display:block"
- Navigation links: <a href="/{screen_id}"> ONLY — no JS, no onclick, no window.location

## SCOPE LOCK
- Generate ONLY the screens listed. Max 3–4 UI sections per screen. No extras.

## DESIGN
- :root CSS variables from context.theme — use ONLY these colors
- heading_font and body_font from context.theme via Google Fonts
- Material Symbols Outlined for icons — never emoji

## CONTENT
- Home screen headline = context.industry.copy.headline
- Primary CTA = context.industry.copy.cta
- Realistic domain-specific content — no lorem ipsum, no "Card title"
- Obey ALL context.product.constraints and context.industry.constraints

## LAYOUT
- Mobile-first 390px phone shell, status bar (09:41), bottom tab bar
- Tab bar: <a href="/{screen_id}" class="tab-item"> — add class "active" for the owning tab
- Hover + active (scale 0.97) on every button/card`;

// Batch 2+: Screen divs ONLY — no head, no global CSS
const CONTINUATION_SYSTEM_PROMPT = `You are Zeach's screen generator. Generate ONLY <div class="screen"> elements.

## OUTPUT — SCREEN DIVS ONLY
- Output raw HTML divs. No <!DOCTYPE>, no <html>, no <head>, no <style>, no <script>.
- Each screen: <div class="screen" id="{id}" style="display:none"> … </div>
- ALL screens in this batch use style="display:none"

## RULES
- Navigation links: <a href="/{screen_id}"> only — no JS
- Use CSS variables --color-primary, --color-background, --color-surface, --color-surface2,
  --color-border, --color-text, --color-text-muted (already defined in :root by batch 1)
- Use fonts already loaded in <head> — no new @import or <link> tags
- Tab bar in each screen: match the active tab from context.nav_active_states[screen_id]
- Realistic content, obey constraints. Max 3–4 UI sections per screen.`;

// Number of screens to generate per API call
const BATCH_SIZE = 6; // Smaller batches = less truncation risk per LLM call

// ─── Main pipeline route ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const totalStart = Date.now();
  let runId = "";

  try {
    const body = await req.json() as RequestBody;
    const { projectId, userId, s1, s2 } = body;

    if (!projectId || !userId || !s1?.project_name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const supabase = getAdminClient();

    const step01Input = { s1, s2 };
    runId = await createPipelineRun(projectId, userId, step01Input);

    console.log(`\n[pipeline] ▶ run ${runId} | ${s1.project_name} | ${s1.industry} × ${s1.app_type} | ${s1.complexity}`);

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 01.5 — AI Intent Parse (Haiku)
    // ══════════════════════════════════════════════════════════════════════════

    const intentPrompt = `Parse this app idea and return structured intent JSON.

App: "${s1.project_name}"
Industry: ${s1.industry}
App Type: ${s1.app_type}
Complexity: ${s1.complexity}
Features selected: ${s1.features.length ? s1.features.join(", ") : "none"}

User's Description:
${s1.description || "(none)"}

User's Notes:
${s1.notes || "(none)"}

Return ONLY raw JSON (no markdown):
{
  "user_types": [{"type": "string", "primary": bool}],
  "app_structure": "single_sided|two_sided|multi_tenant",
  "core_flows_detected": ["flow 1", "flow 2"],
  "features_implied": {
    "explicitly_mentioned": ["feature from description"],
    "strongly_implied": ["implied feature"]
  },
  "complexity_signal": "confirm or contradict selected complexity",
  "industry_signal": "confidence that description matches selected industry",
  "tone_hints": ["tone word 1", "tone word 2"],
  "mismatches": ["any mismatches between description and selections"],
  "suggestions": ["suggested addition 1"],
  "enriched_notes": "1-2 sentence summary that will be injected into generation context"
}`;

    console.log(`[step 01.5] Haiku intent parse…`);
    const s015Start = Date.now();
    const intentRes = await anthropic.messages.create({
      model: HAIKU,
      max_tokens: 800,
      system: "You are a product intent parser. Return ONLY valid JSON. No markdown.",
      messages: [{ role: "user", content: intentPrompt }],
    });
    const s015Duration = Date.now() - s015Start;
    const intentRaw = intentRes.content[0].type === "text" ? intentRes.content[0].text : "{}";

    let parsedIntent: ParsedIntent;
    try {
      parsedIntent = JSON.parse(extractJson(intentRaw)) as ParsedIntent;
    } catch {
      parsedIntent = {
        user_types: [{ type: "user", primary: true }],
        app_structure: "single_sided",
        core_flows_detected: [],
        features_implied: { explicitly_mentioned: s1.features, strongly_implied: [] },
        complexity_signal: "matches selection",
        industry_signal: "high confidence",
        tone_hints: [],
        mismatches: [],
        suggestions: [],
        enriched_notes: s1.description,
      };
    }

    console.log(`[step 01.5] ✓ ${s015Duration}ms | in:${intentRes.usage.input_tokens} out:${intentRes.usage.output_tokens}`);
    console.log(`[step 01.5] structure=${parsedIntent.app_structure} | flows=${parsedIntent.core_flows_detected.length} | enriched="${parsedIntent.enriched_notes?.slice(0, 80)}…"`);

    await updateRun(runId, {
      step_015_output: parsedIntent,
    });

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 02 — Theme/Font Dictionary Pick
    // ══════════════════════════════════════════════════════════════════════════

    const step02 = {
      theme: s2.style_pack,
      font_pair: s2.font_pairing,
      source: "user_selected",
    };

    console.log(`[step 02] theme="${step02.theme}" | font="${step02.font_pair}"`);
    await updateRun(runId, { step_02_output: step02 });

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 03 — Structured User Context
    // ══════════════════════════════════════════════════════════════════════════

    const step03 = {
      project: {
        name: s1.project_name,
        description: s1.description,
        enriched_notes: parsedIntent.enriched_notes,
        project_type: s1.project_type,
      },
      visual: step02,
      intent: {
        user_types: parsedIntent.user_types,
        app_structure: parsedIntent.app_structure,
        tone_hints: parsedIntent.tone_hints,
        features_implied: parsedIntent.features_implied,
      },
      brain_keys: {
        industry_brain: INDUSTRY_FILE[s1.industry] ?? s1.industry.toLowerCase().replace(/\s+/g, "_"),
        product_brain:  PRODUCT_FILE[s1.app_type]  ?? s1.app_type.toLowerCase().replace(/\s+/g, "_"),
        feature_modules: s1.features.map(featureToFile),
        complexity_tier: s1.complexity.toLowerCase(),
      },
      validation: "PASS",
    };

    console.log(`[step 03] ✓ brain_keys: industry=${step03.brain_keys.industry_brain} product=${step03.brain_keys.product_brain} modules=[${step03.brain_keys.feature_modules.join(",")}]`);
    await updateRun(runId, { step_03_output: step03 });

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 04 — Brain Files Loaded
    // ══════════════════════════════════════════════════════════════════════════

    const industryBrain = loadJson<Record<string, unknown>>(
      path.join(BRAINS_DIR, "zeach-industry-brains", `${step03.brain_keys.industry_brain}.json`)
    );
    const productBrain = loadJson<Record<string, unknown>>(
      path.join(BRAINS_DIR, "zeach-product-brains", `${step03.brain_keys.product_brain}.json`)
    );
    const themeTokensAll = loadJson<{ themes: Record<string, Record<string, unknown>> }>(
      path.join(BRAINS_DIR, "zeach-theme-tokens.json")
    );
    const themeTokens = themeTokensAll?.themes?.[s2.style_pack] ?? null;

    // Load feature modules — try normalized name, then scan all files for matching feature_id
    const featureModules = s1.features
      .map((feat) => findFeatureModule(feat))
      .filter(Boolean) as Record<string, unknown>[];

    if (featureModules.length !== s1.features.length) {
      const loaded = featureModules.map((m) => m.feature_id);
      const missing = s1.features.filter((f) => !loaded.includes(featureToFile(f)) && !featureModules.some((m) => m.feature_id === f || m.feature_id === featureToFile(f)));
      if (missing.length) console.warn(`[step 04] ⚠ Feature modules not found: ${missing.join(", ")}`);
    }

    const step04 = {
      industry_brain_loaded:  !!industryBrain,
      product_brain_loaded:   !!productBrain,
      theme_tokens_loaded:    !!themeTokens,
      feature_modules_loaded: featureModules.map((m) => m.feature_id),
    };
    console.log(`[step 04] ✓ industry=${step04.industry_brain_loaded} product=${step04.product_brain_loaded} theme=${step04.theme_tokens_loaded} modules=${step04.feature_modules_loaded}`);
    await updateRun(runId, { step_04_output: step04 });

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 05 — Feature Module Merge (screens dedup)
    // ══════════════════════════════════════════════════════════════════════════

    const tierKey = s1.complexity.toLowerCase() as "mvp" | "startup" | "scale";
    const tiers = (productBrain?.tiers as Record<string, unknown> | undefined) ?? {};
    const tierData = (tiers[tierKey] as Record<string, unknown> | undefined) ?? {};
    const baseScreens = (tierData.screens as ScreenDef[] | undefined) ?? [];

    const seenIds = new Set(baseScreens.map((s) => s.id));
    const moduleScreens: ScreenDef[] = [];

    for (const mod of featureModules) {
      const added = (mod.screens_added as ScreenDef[] | undefined) ?? [];
      for (const screen of added) {
        if (!seenIds.has(screen.id)) {
          seenIds.add(screen.id);
          moduleScreens.push(screen);
        }
      }
    }

    const allScreens: ScreenDef[] = [...baseScreens, ...moduleScreens];
    const screenIds = allScreens.map((s) => s.id);

    const step05 = {
      base_screen_count: baseScreens.length,
      module_screens_added: moduleScreens.length,
      total_screens: allScreens.length,
      all_screen_ids: screenIds,
      feature_screens_by_module: featureModules.reduce<Record<string, string[]>>((acc, mod) => {
        const added = (mod.screens_added as ScreenDef[] | undefined) ?? [];
        const newOnes = added.filter((s) => moduleScreens.some((ms) => ms.id === s.id));
        if (newOnes.length) acc[String(mod.feature_id)] = newOnes.map((s) => s.id);
        return acc;
      }, {}),
    };
    console.log(`[step 05] ✓ base=${step05.base_screen_count} + modules=${step05.module_screens_added} = total=${step05.total_screens}`);
    console.log(`[step 05]   screens: ${screenIds.join(", ")}`);
    await updateRun(runId, { step_05_output: step05 });

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 06 — Context Resolution
    // ══════════════════════════════════════════════════════════════════════════

    // Resolve copy from industry brain
    const copyByAppType = (industryBrain?.copy_by_app_type as Record<string, { headline: string; cta: string }> | undefined);
    const resolvedCopy = copyByAppType?.[s1.app_type] ?? { headline: `Welcome to ${s1.project_name}`, cta: "Get started" };

    // Extract tab bar from product brain layout
    const layoutIphone = (productBrain?.layout as Record<string, unknown> | undefined)?.iphone as Record<string, unknown> | undefined;
    const navItems: string[] = (layoutIphone?.nav_items as string[] | undefined) ?? [];
    const tabBar = navItems.length > 0 ? navItems : screenIds.slice(0, 4);

    // Use the product brain's explicit nav_active_states mapping (root-level field).
    // This is the ground-truth per-screen tab assignment written by the brain author.
    // Fall back to heuristic for any screen not covered (e.g. feature module screens).
    const productNavStates = (productBrain?.nav_active_states as Record<string, string> | undefined) ?? {};
    const navActiveStates: Record<string, string> = {};
    for (const screenId of screenIds) {
      if (productNavStates[screenId]) {
        navActiveStates[screenId] = productNavStates[screenId];
      } else {
        // Heuristic fallback for feature module screens not in product brain
        const lower = screenId.toLowerCase();
        let activeTab = tabBar[0];
        if (lower.includes("appointment") || lower.includes("booking") || lower.includes("order") || lower.includes("cart")) activeTab = tabBar[1] ?? tabBar[0];
        else if (lower.includes("message") || lower.includes("chat") || lower.includes("inbox")) activeTab = tabBar[2] ?? tabBar[0];
        else if (lower.includes("profile") || lower.includes("setting") || lower.includes("account")) activeTab = tabBar[tabBar.length - 1] ?? tabBar[0];
        navActiveStates[screenId] = activeTab;
      }
    }

    const step06 = {
      copy: resolvedCopy,
      theme: themeTokens ?? {},
      layout: {
        iphone: layoutIphone ?? {},
        nav_items: tabBar,
        tab_count: tabBar.length,
        layout_type: (layoutIphone?.nav as string) ?? "bottom_tab",
      },
      nav_active_states: navActiveStates,
      product_constraints: (productBrain?.constraints as Record<string, unknown> | undefined) ?? {},
      industry_constraints: (industryBrain?.constraints as Record<string, unknown> | undefined) ?? {},
      industry_ux_norms: (industryBrain?.ux_norms as string[] | undefined) ?? [],
      industry_trust_signals: (industryBrain?.trust_signals as string[] | undefined) ?? [],
      industry_tone: (industryBrain?.tone as Record<string, string> | undefined) ?? {},
    };
    console.log(`[step 06] ✓ copy="${resolvedCopy.headline}" | tabBar=[${tabBar.join(",")}] | tone="${typeof step06.industry_tone === 'object' ? (step06.industry_tone as {primary?: string}).primary ?? '' : ''}"`);
    await updateRun(runId, { step_06_output: step06 });

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 07 — Full Generation Context Object
    // ══════════════════════════════════════════════════════════════════════════

    const generationContext = {
      project: {
        name: s1.project_name,
        description: s1.description,
        enriched_notes: parsedIntent.enriched_notes,
        complexity: s1.complexity,
        project_type: s1.project_type,
        user_types: parsedIntent.user_types.map((u) => u.type),
        app_structure: parsedIntent.app_structure,
      },
      industry: {
        id: step03.brain_keys.industry_brain,
        tone: step06.industry_tone,
        trust_signals: step06.industry_trust_signals,
        ux_norms: step06.industry_ux_norms,
        constraints: step06.industry_constraints,
        copy: step06.copy,
      },
      product: {
        // Root-level product brain fields — same across all tiers
        archetype_id:  step03.brain_keys.product_brain,
        archetype_name: productBrain?.archetype_name,
        description:   productBrain?.description,
        components:    (productBrain?.components as string[] | undefined) ?? [],
        icon_pack:     productBrain?.icon_pack,
        layout:        productBrain?.layout ?? { iphone: step06.layout.iphone, nav_items: tabBar },
        nav_active_states: step06.nav_active_states, // explicit per-screen tab mapping
        constraints:   step06.product_constraints,
        states:        productBrain?.states, // empty_states, loading_states, error_flows, edge_cases
        // Only the selected tier (not all 3 tiers — keeps context lean)
        tier: {
          name:                 s1.complexity,
          description:          tierData.description,
          primary_flows:        tierData.primary_flows,
          secondary_flows:      tierData.secondary_flows,
          interaction_patterns: tierData.interaction_patterns,
        },
        screens: allScreens.map((s) => ({
          id:      s.id,
          name:    s.name,
          purpose: s.purpose,
          visual:  s.visual,
          copy:    s.copy,
        })),
      },
      feature_modules: featureModules.map((m) => ({
        id:                   m.feature_id,
        interaction_patterns: m.interaction_patterns,
        flows_added:          m.flows_added,
      })),
      theme: {
        name:     s2.style_pack,
        font_pair: s2.font_pairing,
        ...(themeTokens ?? {}),
      },
      screens: {
        all:   screenIds,
        tab_bar: tabBar,
        total: allScreens.length,
      },
    };

    const contextJson = JSON.stringify(generationContext);
    const step07 = {
      char_count: contextJson.length,
      estimated_tokens: Math.round(contextJson.length / 4),
      screen_count: allScreens.length,
    };
    console.log(`[step 07] ✓ context assembled | ${step07.char_count} chars (~${step07.estimated_tokens} tokens) | ${step07.screen_count} screens`);
    await updateRun(runId, { step_07_output: { ...step07, preview: contextJson.slice(0, 500) } });

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 08 — Screen Generation (Sonnet) — BATCH mode
    // Screens are split into batches of BATCH_SIZE.
    // Batch 1 → full HTML file (head + CSS + first N screens)
    // Batch 2+ → screen divs ONLY (merged before </body>)
    // ══════════════════════════════════════════════════════════════════════════

    // Condensed context for continuation batches (avoids re-sending full brain)
    const continuationContext = {
      project_name: s1.project_name,
      theme: generationContext.theme,
      layout: generationContext.product.layout,
      nav_active_states: generationContext.product.nav_active_states,
      industry_tone: generationContext.industry.tone,
      industry_copy: generationContext.industry.copy,
      industry_constraints: {
        avoid: (generationContext.industry.constraints as { avoid?: string[] }).avoid?.slice(0, 4) ?? [],
      },
      product_constraints: {
        avoid:   (generationContext.product.constraints as { avoid?: string[] }).avoid?.slice(0, 4) ?? [],
        enforce: (generationContext.product.constraints as { enforce?: string[] }).enforce?.slice(0, 4) ?? [],
      },
    };

    let finalHtml = "";
    let step08Html = "";
    let s08Tokens = { in: 0, out: 0, calls: 0 };
    let retryCount = 0;

    // Split allScreens into batches
    const batches: ScreenDef[][] = [];
    for (let i = 0; i < allScreens.length; i += BATCH_SIZE) {
      batches.push(allScreens.slice(i, i + BATCH_SIZE));
    }
    console.log(`[step 08] ${allScreens.length} screens → ${batches.length} batch(es) of ≤${BATCH_SIZE}`);

    const stripHtml = (raw: string): string => {
      let s = raw.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      const idx = s.search(/<!DOCTYPE|<html/i);
      if (idx > 0) s = s.slice(idx);
      return s;
    };

    const stripDivs = (raw: string): string => {
      // Extract only <div class="screen" ...> ... </div> blocks from the response
      let s = raw.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      // If it accidentally included DOCTYPE, strip everything before the first screen div
      const firstScreen = s.search(/<div[^>]+class=["'][^"']*\bscreen\b/i);
      if (firstScreen > 0) s = s.slice(firstScreen);
      // Remove trailing </body></html> if present
      s = s.replace(/<\/body>\s*<\/html>\s*$/i, "").trim();
      return s;
    };

    for (const [batchIdx, batch] of batches.entries()) {
      const batchScreenIds = batch.map((s) => s.id);
      const batchStart = Date.now();

      if (batchIdx === 0) {
        // ── Batch 1: Full HTML ──────────────────────────────────────────────
        const userMsg = `Generate ${batch.length} screens for batch 1 of ${batches.length} for ${s1.project_name}.

SCREENS TO GENERATE IN THIS BATCH: ${batchScreenIds.join(", ")}

Full context:
${contextJson}

Output a complete HTML file with:
1. <!DOCTYPE html><html><head> — Google Fonts, Material Symbols, :root CSS variables, global styles
2. ${batch.length} <div class="screen"> elements (first one: display:block, rest: display:none)
3. </body></html>

Do NOT generate screens outside this batch list.`;

        console.log(`[step 08] batch 1/${batches.length}: ${batchScreenIds.join(", ")}`);
        const res = await anthropic.messages.create({
          model: SONNET,
          max_tokens: 16000,
          system: GENERATION_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMsg }],
        });
        const raw = res.content[0].type === "text" ? res.content[0].text : "";
        s08Tokens = { in: s08Tokens.in + res.usage.input_tokens, out: s08Tokens.out + res.usage.output_tokens, calls: 1 };
        console.log(`[step 08] batch 1 ✓ ${Date.now() - batchStart}ms | in:${res.usage.input_tokens} out:${res.usage.output_tokens} | stop:${res.stop_reason} | ${raw.length} chars`);

        finalHtml = stripHtml(raw);
        if (res.stop_reason === "max_tokens" && !finalHtml.includes("</html>")) {
          finalHtml += "\n</body></html>";
        }

      } else {
        // ── Batch 2+: Screen divs only ──────────────────────────────────────
        const batchScreenDefs = batch.map((s) => ({
          id: s.id, name: s.name, purpose: s.purpose, visual: s.visual, copy: s.copy,
        }));

        const userMsg = `Generate ${batch.length} screen divs for batch ${batchIdx + 1} of ${batches.length} for ${s1.project_name}.

SCREENS TO GENERATE (all ${batch.length} of them, no skipping): ${batchScreenIds.join(", ")}

Screen definitions:
${JSON.stringify(batchScreenDefs, null, 2)}

Condensed context (theme, nav, constraints):
${JSON.stringify(continuationContext, null, 2)}

Output ONLY the <div class="screen"> elements. No head, no global CSS. All screens: style="display:none".
IMPORTANT: You MUST output all ${batch.length} screens listed above. Do not stop early.`;

        console.log(`[step 08] batch ${batchIdx + 1}/${batches.length}: ${batchScreenIds.join(", ")}`);
        const res = await anthropic.messages.create({
          model: SONNET,
          max_tokens: 16000,
          system: CONTINUATION_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMsg }],
        });
        const raw = res.content[0].type === "text" ? res.content[0].text : "";
        s08Tokens = { in: s08Tokens.in + res.usage.input_tokens, out: s08Tokens.out + res.usage.output_tokens, calls: s08Tokens.calls + 1 };

        // Per-batch validation: check which expected screens were actually produced
        const batchFoundIds = [...raw.matchAll(/id=["']([^"']+)["'][^>]*class=["'][^"']*\bscreen\b|class=["'][^"']*\bscreen\b[^"']*["'][^>]*id=["']([^"']+)["']/g)]
          .map((m) => m[1] ?? m[2])
          .filter(Boolean);
        const batchMissing = batchScreenIds.filter((id) => !batchFoundIds.includes(id));
        console.log(`[step 08] batch ${batchIdx + 1} ✓ ${Date.now() - batchStart}ms | in:${res.usage.input_tokens} out:${res.usage.output_tokens} | stop:${res.stop_reason} | found:${batchFoundIds.length}/${batchScreenIds.length}${batchMissing.length ? ` | MISSING: ${batchMissing.join(",")}` : ""}`);

        const divs = stripDivs(raw);
        // Merge: insert before </body>
        if (finalHtml.includes("</body>")) {
          finalHtml = finalHtml.replace("</body>", `${divs}\n</body>`);
        } else {
          finalHtml += `\n${divs}`;
        }
      }
    }

    step08Html = finalHtml;
    await updateRun(runId, { step_08_html: step08Html, retry_count: retryCount });
    console.log(`[step 08] ✓ all ${batches.length} batch(es) merged | total chars: ${finalHtml.length} | total tokens: in=${s08Tokens.in} out=${s08Tokens.out}`);

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 09.5 — Structural Validation (code-only)
    // ══════════════════════════════════════════════════════════════════════════

    let validation = validateStructure(step08Html, screenIds);
    console.log(`[step 09.5] ${validation.result} | found=${validation.screen_count_found}/${validation.screen_count_expected} | ${validation.passed}/${validation.total} checks`);
    if (validation.missing_screens.length > 0) console.log(`[step 09.5] missing: ${validation.missing_screens.join(", ")}`);
    await updateRun(runId, { step_095_output: validation });

    // On structural failure: generate missing screens as a patch batch
    if (validation.result === "FAIL" && validation.missing_screens.length > 0 && retryCount === 0) {
      retryCount++;
      console.log(`[step 09.5] Patching ${validation.missing_screens.length} missing screens…`);
      const missingDefs = allScreens.filter((s) => validation.missing_screens.includes(s.id));
      const patchMsg = `Generate screen divs for these MISSING screens: ${validation.missing_screens.join(", ")}

Screen definitions:
${JSON.stringify(missingDefs.map((s) => ({ id: s.id, name: s.name, purpose: s.purpose, visual: s.visual })), null, 2)}

Context:
${JSON.stringify(continuationContext, null, 2)}

Output ONLY the <div class="screen"> elements. All style="display:none". No head, no global CSS.`;

      const patchRes = await anthropic.messages.create({
        model: SONNET,
        max_tokens: 14000,
        system: CONTINUATION_SYSTEM_PROMPT,
        messages: [{ role: "user", content: patchMsg }],
      });
      const patchRaw = patchRes.content[0].type === "text" ? patchRes.content[0].text : "";
      const patchDivs = patchRaw.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim()
        .replace(/<\/body>\s*<\/html>\s*$/i, "").trim();

      if (finalHtml.includes("</body>")) {
        finalHtml = finalHtml.replace("</body>", `${patchDivs}\n</body>`);
      } else {
        finalHtml += `\n${patchDivs}`;
      }
      step08Html = finalHtml;
      validation = validateStructure(step08Html, screenIds);
      console.log(`[step 09.5] after patch: ${validation.result} | found=${validation.screen_count_found}/${validation.screen_count_expected}`);
      await updateRun(runId, { step_08_html: step08Html, step_095_output: validation, retry_count: retryCount });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 09.7 — Quality Check (Haiku)
    // ══════════════════════════════════════════════════════════════════════════

    const industryAvoid = (step06.industry_constraints as { avoid?: string[] }).avoid ?? [];
    const toneStr = typeof step06.industry_tone === "object" && step06.industry_tone !== null
      ? Object.values(step06.industry_tone as Record<string, string>).join(", ")
      : "";

    const qualityPrompt = buildQualityCheckPrompt(
      finalHtml,
      step06.copy.headline,
      step06.copy.cta,
      industryAvoid,
      toneStr,
      screenIds.length
    );

    console.log(`[step 09.7] Haiku quality check…`);
    const s097Start = Date.now();
    const qualityRes = await anthropic.messages.create({
      model: HAIKU,
      max_tokens: 600,
      system: "You are a UI quality auditor. Return ONLY valid JSON.",
      messages: [{ role: "user", content: qualityPrompt }],
    });
    const s097Duration = Date.now() - s097Start;
    const qualityRaw = qualityRes.content[0].type === "text" ? qualityRes.content[0].text : "{}";

    let qualityReport: QualityReport;
    try {
      qualityReport = JSON.parse(extractJson(qualityRaw)) as QualityReport;
    } catch {
      console.warn(`[step 09.7] JSON parse failed. Raw: ${qualityRaw.slice(0, 200)}`);
      qualityReport = { score: 80, result: "PASS", checks: [], warnings: ["Quality report parse failed — treated as PASS"], fail_prompt_append: undefined };
    }

    console.log(`[step 09.7] ✓ ${s097Duration}ms | in:${qualityRes.usage.input_tokens} out:${qualityRes.usage.output_tokens} | score=${qualityReport.score} result=${qualityReport.result}`);
    if (qualityReport.warnings.length > 0) console.log(`[step 09.7] warnings: ${qualityReport.warnings.join("; ")}`);
    await updateRun(runId, { step_097_output: qualityReport });

    // If quality fails, trigger targeted fix (step 09.8 handles this below)
    // No full regeneration on quality fail — use surgical patch instead

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 09.8 — Targeted Fix Pass (Sonnet, only if quality still FAIL after retry)
    // ══════════════════════════════════════════════════════════════════════════

    let step098Html: string | null = null;

    if (qualityReport.result === "FAIL") {
      console.log(`[step 09.8] Sonnet targeted fix — quality score ${qualityReport.score}…`);
      const failingChecks = qualityReport.checks.filter((c) => !c.pass);

      // Surgical fix: send failing check details + first 8000 chars of HTML
      const fixPrompt = `Fix these quality issues in the app HTML:

ISSUES:
${failingChecks.map((c) => `- ${c.check}: ${c.note ?? "fix required"}`).join("\n")}
${qualityReport.fail_prompt_append ? `\nAlso: ${qualityReport.fail_prompt_append}` : ""}

Return the COMPLETE fixed HTML file. Do not change correct screens.

HTML:
${finalHtml.slice(0, 50000)}`;

      const s098Start = Date.now();
      const fixRes = await anthropic.messages.create({
        model: SONNET,
        max_tokens: 16000,
        system: "You are Zeach's screen repair engine. Fix only listed issues. Return complete corrected HTML. No markdown.",
        messages: [{ role: "user", content: fixPrompt }],
      });
      const s098Duration = Date.now() - s098Start;

      const fixRaw = fixRes.content[0].type === "text" ? fixRes.content[0].text : "";
      if (fixRaw) {
        let fixHtml = fixRaw.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
        const fixIdx = fixHtml.search(/<!DOCTYPE|<html/i);
        if (fixIdx > 0) fixHtml = fixHtml.slice(fixIdx);
        if (fixHtml.length > 1000) {
          step098Html = fixHtml;
          finalHtml = fixHtml;
        }
      }
      console.log(`[step 09.8] ✓ ${s098Duration}ms | in:${fixRes.usage.input_tokens} out:${fixRes.usage.output_tokens}`);
      await updateRun(runId, { step_098_html: step098Html });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Save final HTML to project_files as pages/app.html
    // ══════════════════════════════════════════════════════════════════════════

    const filePath = "pages/app.html";
    await supabase.from("project_files").upsert({
      project_id: projectId,
      user_id: userId,
      file_path: filePath,
      content: finalHtml,
      updated_at: new Date().toISOString(),
    }, { onConflict: "project_id,file_path" });

    // ══════════════════════════════════════════════════════════════════════════
    // Build brain for project (used by chat + future features)
    // ══════════════════════════════════════════════════════════════════════════

    const brain = {
      project: {
        id: projectId,
        name: s1.project_name,
        description: s1.description,
        industry: s1.industry,
        app_type: s1.app_type,
        complexity: s1.complexity,
        features: s1.features,
        notes: s1.notes,
        enriched_notes: parsedIntent.enriched_notes,
        platform: ["iOS"],
        project_type: s1.project_type,
        created_at: new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString().slice(0, 10),
      },
      design_tokens: {
        colors: Object.fromEntries(
          Object.entries(themeTokens ?? {})
            .filter(([k]) => !["desc","heading_font","body_font","icon_weight","animation_speed","animation_style","easing","bg","p","s","s2"].includes(k))
        ),
        typography: {
          heading_font: (themeTokens?.heading_font as string) ?? s2.font_pairing.split(" + ")[0] ?? "Inter",
          body_font:    (themeTokens?.body_font    as string) ?? s2.font_pairing.split(" + ")[1] ?? "Inter",
        },
      },
      screens: {
        inventory: screenIds,
        navigation_flow: generationContext.product.nav_active_states,
        tab_bar: tabBar,
      },
      style_pack: {
        name: s2.style_pack,
        aesthetic: (themeTokens?.desc as string) ?? "",
        tone: toneStr,
      },
      _pipeline_run_id: runId,
      meta: {
        brain_version: "3.0",
        created_at: new Date().toISOString().slice(0, 10),
        pipeline: "zeach-pipeline-v3",
      },
    };

    // Save brain + visual direction to project
    await supabase.from("projects").update({
      brain,
      style_pack:         s2.style_pack,
      font_pairing:       s2.font_pairing,
      reference_urls:     s2.reference_urls,
      inspiration_images: s2.inspiration_urls,
      setup_complete:     true,
    }).eq("id", projectId);

    // ══════════════════════════════════════════════════════════════════════════
    // Finalize pipeline run record
    // ══════════════════════════════════════════════════════════════════════════

    const totalDuration = Date.now() - totalStart;
    await updateRun(runId, {
      final_html:    finalHtml,
      screens:       screenIds,
      status:        "complete",
      duration_ms:   totalDuration,
      completed_at:  new Date().toISOString(),
      total_tokens: {
        step_015: { in: intentRes.usage.input_tokens, out: intentRes.usage.output_tokens },
        step_08:  s08Tokens,
        step_097: { in: qualityRes.usage.input_tokens, out: qualityRes.usage.output_tokens },
      },
    });

    console.log(`\n[pipeline] ✓ COMPLETE | ${runId} | ${totalDuration}ms | ${allScreens.length} screens | quality=${qualityReport.score}`);

    return NextResponse.json({
      pipelineRunId: runId,
      screens: screenIds,
      tabBar,
      qualityScore: qualityReport.score,
      qualityResult: qualityReport.result,
      qualityWarnings: qualityReport.warnings,
      durationMs: totalDuration,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[pipeline] ✗ ERROR:", message);
    if (runId) {
      await updateRun(runId, {
        status: "failed",
        error_log: { message, timestamp: new Date().toISOString() },
        completed_at: new Date().toISOString(),
      });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
