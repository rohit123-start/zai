import { buildPrompt, ZeachInputs } from "./buildPrompt";

const SYSTEM_PROMPT = `
You are a UI generator that must strictly follow scope and avoid overbuilding.

When given a structured screen generation request, output ONLY a single complete self-contained HTML file.

## CRITICAL — WHAT YOU ARE BUILDING
You are building the UI screens of the END-USER APPLICATION described in the inputs.
You are NOT building a tool that creates applications, generates prompts, or fills in forms.
You are NOT building a meta-tool, admin panel, or project creator.

The "Describe your idea" field tells you WHAT THE APP DOES FOR ITS USERS.
Build the screens that the end users of that product would see and interact with.

Examples:
- "A finance dashboard that helps banking teams analyse KPIs" → build the finance dashboard, NOT a tool that builds finance dashboards
- "A food delivery app where users order meals" → build the food ordering screen, NOT a tool that creates food apps
- "A fitness tracker that logs workouts" → build the workout logging screen, NOT a project creator

## STRICT OUTPUT RULES
- Raw HTML only. Start with <!DOCTYPE html>. Zero markdown, zero code fences, zero explanation before or after.
- All CSS in one <style> block in <head>. All JS in one <script> block before </body>.
- No external CSS files. No external JS files. Everything inline.

## SCOPE LOCK (MOST IMPORTANT)

1. SCOPE LOCK
   - Only generate what is explicitly requested for this specific screen
   - Do NOT add extra screens, layouts, or system-level UI not in the request
   - Do NOT assume full product context — build ONLY what the target screen requires

2. SINGLE SCREEN FOCUS
   - This response is ONE screen only
   - Do NOT mix multiple product layers in a single output
   - Maximum 3–4 UI sections per screen

3. NO FEATURE EXPANSION
   - Do NOT introduce features not mentioned in the prompt
   - Do NOT "improve" by adding more components or decorative sections
   - Industry / App Type are for VISUAL AESTHETIC only — do NOT derive features from them

4. MINIMAL DEFAULTS
   When in doubt → choose the simplest possible implementation

5. OUTPUT DISCIPLINE
   Before generating, internally validate:
   "Am I adding anything not explicitly asked for this screen?"
   If YES → remove it

6. DESIGN PRINCIPLE
   "Precision over completeness" · "Relevance over impressiveness"

## NAVIGATION RULES (CRITICAL FOR SCREEN SWITCHING)
- ALL inter-screen links MUST use <a href="/screen_name"> format
  - lowercase_snake_case, no .html extension, no pages/ prefix
  - Example: <a href="/home">, <a href="/product_detail">, <a href="/checkout">
- Tab bar items, sidebar links, CTA buttons that open other screens → ALL use <a href="/screen_name">
- Do NOT use window.location, history.pushState, or JS for navigation — use <a href> only
- The preview system intercepts these href values to switch screens seamlessly with a smooth transition

## DESIGN TOKEN RULES
- Map ALL colors from the input into CSS :root variables: --color-primary, --color-background, etc.
- Use the exact heading_font and body_font from the input via Google Fonts CDN import.
- Load Material Symbols from: https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0
- Apply the global theme radius, shadows, and spacing values exactly.

## LAYOUT RULES
- Read layout.base from globalTheme. "desktop" → sidebar (240px fixed) + sticky topbar + main content. "mobile" → 390px centered phone shell, status bar, bottom tab bar.
- Always produce THREE breakpoints: mobile (≤768px), tablet (769–1279px), desktop (≥1280px).
- On mobile: hide sidebar, show bottom tab bar. On desktop: show sidebar, hide bottom tab bar.

## CONTENT RULES
- Realistic, domain-specific data only. No lorem ipsum. No placeholder text like "Card title".
- Match the tone from the input.
- Every interactive element needs hover + active states. Cards get hover lift (translateY -2px, shadow increase).
- Entrance animation on page load: CSS @keyframes fadeSlideUp, stagger each section by 60ms.
- Status bar (mobile): show time 09:41, battery icon, signal bars — top of the phone shell.
- Bottom tab bar (mobile): use navigation_icons from input, highlight the active screen's tab icon.

## QUALITY BAR
- Production-ready and pixel-polished.
- No grey placeholder boxes. No "TODO". No skeleton text. Real content only.
- Material Symbols only — never emoji as icons.
`.trim();

export interface GenerateResult {
  html: string;
  error?: string;
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
}

// 8,000 output tokens/min tier — use full budget per screen, wait 65s between screens
const MAX_TOKENS = 15000;
const MAX_RETRIES = 4;

// Wait 65s between sequential screens so the rate-limit window fully resets
export const INTER_SCREEN_DELAY_MS = 12000;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function generateScreen(inputs: ZeachInputs): Promise<GenerateResult> {
  const startTime = Date.now();

  // ── Log LLM-3 inputs ────────────────────────────────────────────────────────
  const userPrompt = buildPrompt(inputs);

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log(`║   LLM-3 INPUT: ZeachInputs → "${inputs.targetScreen}"   ║`);
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(JSON.stringify({
    appName:      inputs.appName,
    targetScreen: inputs.targetScreen,
    complexity:   inputs.complexity,
    description:  inputs.description,
    notes:        inputs.notes,
    industry:     inputs.industry,
    appType:      inputs.appType,
    stylePack:    inputs.stylePack,
    tone:         inputs.tone,
    darkMode:     inputs.darkMode,
    features:     inputs.features,
    colors:       inputs.colors,
    typography: {
      heading_font: inputs.typography.heading_font,
      body_font:    inputs.typography.body_font,
      scale:        inputs.typography.scale,
    },
    icons: inputs.icons,
  }, null, 2));


  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    let response: Response;

    try {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: MAX_TOKENS,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : "Network error";
      if (attempt < MAX_RETRIES) {
        console.warn(`[generateScreen] network error, retrying (${attempt}/${MAX_RETRIES})…`);
        await sleep(3000 * attempt);
        continue;
      }
      return { html: "", error: msg, durationMs: Date.now() - startTime };
    }

    // Rate limited — wait for the reset window then retry
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get("retry-after") ?? "60", 10);
      const waitMs = (retryAfter + 2) * 1000; // add 2s buffer
      console.warn(
        `[generateScreen] 429 rate limit — waiting ${retryAfter}s before retry (${attempt}/${MAX_RETRIES})`
      );
      if (attempt < MAX_RETRIES) {
        await sleep(waitMs);
        continue;
      }
      return {
        html: "",
        error: `Rate limit hit. Try again in ~${retryAfter}s.`,
        durationMs: Date.now() - startTime,
      };
    }

    if (!response.ok) {
      const errText = await response.text();
      return {
        html: "",
        error: `Anthropic API error ${response.status}: ${errText}`,
        durationMs: Date.now() - startTime,
      };
    }

    const data = await response.json() as {
      content?: { type: string; text: string }[];
      usage?: { input_tokens: number; output_tokens: number };
      error?: { message: string };
    };

    if (data.error) {
      return {
        html: "",
        error: data.error.message,
        durationMs: Date.now() - startTime,
      };
    }

    let raw = data.content?.[0]?.text ?? "";
    const stopReason = (data as Record<string, unknown>).stop_reason as string | undefined;

    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log(`║   LLM-3 RAW RESPONSE → "${inputs.targetScreen}"           ║`);
    console.log("╚══════════════════════════════════════════════════╝");
    console.log(`Duration: ${Date.now() - startTime}ms | Tokens: in=${data.usage?.input_tokens} out=${data.usage?.output_tokens} | Stop: ${stopReason}`);
    console.log(raw.slice(0, 500) + (raw.length > 500 ? `\n… [${raw.length} chars total]` : ""));
    console.log("══════════════════════════════════════════════════\n");

    // Strip accidental markdown fences
    raw = raw
      .replace(/^```html\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    // The model sometimes adds a preamble sentence before the HTML — slice to the actual document start
    const htmlIdx = raw.search(/<!DOCTYPE|<html/i);
    if (htmlIdx > 0) raw = raw.slice(htmlIdx);

    if (!raw.match(/^<!DOCTYPE|^<html/i)) {
      return {
        html: "",
        error: "Model did not return valid HTML",
        durationMs: Date.now() - startTime,
      };
    }

    // Warn (but don't fail) if the output was cut off by max_tokens
    if (stopReason === "max_tokens") {
      console.warn(`[generateScreen] output was truncated (max_tokens reached) for attempt ${attempt}. HTML may be incomplete.`);
      // Close any open tags so the browser can at least render what we have
      if (!raw.includes("</body>")) raw += "\n</body></html>";
    }

    return {
      html: raw,
      durationMs: Date.now() - startTime,
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens,
    };
  }

  // Should never reach here
  return { html: "", error: "Max retries exceeded", durationMs: Date.now() - startTime };
}
