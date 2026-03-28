import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface S1Inputs {
  project_name: string;
  description: string;
  industry: string;
  app_type: string;
  project_type: string;
  complexity: "MVP" | "Startup" | "Scale";
  features: string[];
  notes: string;
  /** Condensed industry brain from DB (ux_norms, tone, constraints, copy) */
  industry_brain?: Record<string, unknown> | null;
  /** Condensed product brain for the selected complexity tier from DB */
  product_brain?: Record<string, unknown> | null;
}

export interface S2Inputs {
  style_pack: string;
  font_pairing: string;
  screenshot_count: number;
  inspiration_image_count: number;
  reference_urls: string[];
  /** Full theme token JSON from DB or catalog */
  theme_tokens?: Record<string, unknown> | null;
}

/** Structured user intent extracted by LLM 1 */
export interface ParsedIntent {
  app_purpose: string;
  primary_users: string;
  core_value_prop: string;
  key_user_flows: string[];
  must_have_features: string[];
  app_personality: string;
  unique_differentiators: string;
  implied_screens: string[];
  content_tone: string;
}

export interface LLMScreenPlan {
  screens: string[];
  nav_flow: Record<string, string[]>;
  tab_bar: string[];
  aesthetic: { aesthetic: string; tone: string; motion: string };
  icons: { set: string; primary_icons: string[] };
}

interface RequestBody {
  s1: S1Inputs;
  s2: S2Inputs;
}

// ─── Screen count caps ────────────────────────────────────────────────────────

const COMPLEXITY_SCREEN_COUNT: Record<string, { min: number; max: number }> = {
  MVP:     { min: 5,  max: 8  },
  Startup: { min: 9,  max: 13 },
  Scale:   { min: 14, max: 20 },
};

// ─── LLM 1: User Intent Parser ────────────────────────────────────────────────
// Reads raw user text (description + notes) and extracts structured intent.

function buildLLM1IntentPrompt(s1: S1Inputs): string {
  return `Parse the following app idea and extract the user's intent as structured JSON.

## Raw User Input
- App Name: ${s1.project_name}
- Industry: ${s1.industry}
- App Type: ${s1.app_type}
- Project Type: ${s1.project_type} (new_idea = building from scratch; existing_app = redesigning)
- Complexity: ${s1.complexity}
- Features selected: ${s1.features.length ? s1.features.join(", ") : "none"}

## User's Description (their own words)
${s1.description || "(no description provided)"}

## User's Additional Notes (their own words)
${s1.notes || "(no additional notes)"}

## Instructions
- Be literal — extract only what the user actually said or strongly implied.
- Do NOT invent ideas not present in the user's text.
- If a field has no evidence from user input, use "not specified".
- implied_screens: list only screens clearly implied by the user's description (snake_case).
- key_user_flows: describe the main journeys a user takes through the app.
- must_have_features: list capabilities the user explicitly mentioned or clearly needs.

Output ONLY raw JSON (no markdown, no explanation):
{
  "app_purpose": "one clear sentence: what this app does based on user's description",
  "primary_users": "who will use this app and what they want to achieve",
  "core_value_prop": "the main value this app delivers to users",
  "key_user_flows": ["flow 1", "flow 2", "flow 3"],
  "must_have_features": ["feature from user input"],
  "app_personality": "tone and feel (derive from their language and the app context)",
  "unique_differentiators": "what makes this app special per the user's description",
  "implied_screens": ["snake_case_screen_name"],
  "content_tone": "formal / casual / playful / professional / etc"
}`;
}

// ─── LLM 2: Screen Plan Builder ───────────────────────────────────────────────
// Takes ParsedIntent from LLM 1 + all structured S1/S2 data → LLMScreenPlan for LLM 3.

function buildLLM2PlanPrompt(s1: S1Inputs, s2: S2Inputs, intent: ParsedIntent): string {
  const screenCount = COMPLEXITY_SCREEN_COUNT[s1.complexity] ?? { min: 6, max: 10 };

  // ── Industry reference context ─────────────────────────────────────────────
  const industryLines: string[] = [];
  if (s1.industry_brain) {
    const ib = s1.industry_brain;
    if (ib.ux_norms) {
      const v = Array.isArray(ib.ux_norms) ? (ib.ux_norms as string[]).join("; ") : String(ib.ux_norms);
      industryLines.push(`- UX norms: ${v}`);
    }
    if (ib.tone) industryLines.push(`- Tone: ${JSON.stringify(ib.tone)}`);
    if (ib.trust_signals) {
      const v = Array.isArray(ib.trust_signals) ? (ib.trust_signals as string[]).join("; ") : String(ib.trust_signals);
      industryLines.push(`- Trust signals: ${v}`);
    }
    if (ib.copy_for_app_type) industryLines.push(`- Copy for this app type: ${JSON.stringify(ib.copy_for_app_type)}`);
    if (ib.constraints) {
      const c = ib.constraints as { avoid?: string[]; enforce?: string[] };
      if (c.avoid?.length)   industryLines.push(`- Avoid: ${c.avoid.join("; ")}`);
      if (c.enforce?.length) industryLines.push(`- Enforce: ${c.enforce.join("; ")}`);
    }
  }

  // ── Product archetype reference context ────────────────────────────────────
  const productLines: string[] = [];
  if (s1.product_brain) {
    const pb = s1.product_brain;
    if (pb.description) productLines.push(`- Archetype description: ${pb.description}`);
    if (Array.isArray(pb.primary_flows) && pb.primary_flows.length)
      productLines.push(`- Typical flows: ${(pb.primary_flows as string[]).join(" | ")}`);
    if (Array.isArray(pb.interaction_patterns) && pb.interaction_patterns.length)
      productLines.push(`- Interaction patterns: ${(pb.interaction_patterns as string[]).join("; ")}`);
    if (pb.icon_pack) {
      const ip = pb.icon_pack as { default_library?: { name: string }; core_nav_icons?: string[]; core_domain_icons?: string[] };
      if (ip.default_library?.name) productLines.push(`- Icon library: ${ip.default_library.name}`);
      if (ip.core_nav_icons?.length) productLines.push(`- Nav icons: ${ip.core_nav_icons.join(", ")}`);
      if (ip.core_domain_icons?.length) productLines.push(`- Domain icons: ${ip.core_domain_icons.join(", ")}`);
    }
    if (pb.layout) {
      const l = pb.layout as Record<string, Record<string, unknown>>;
      if (l.iphone) productLines.push(`- iPhone layout: nav=${l.iphone.nav}, cta=${l.iphone.cta}`);
    }
    if (pb.constraints) {
      const c = pb.constraints as { avoid?: string[]; enforce?: string[] };
      if (c.avoid?.length)   productLines.push(`- Product avoid: ${c.avoid.join("; ")}`);
      if (c.enforce?.length) productLines.push(`- Product enforce: ${c.enforce.join("; ")}`);
    }
    if (Array.isArray(pb.screens) && pb.screens.length) {
      const list = (pb.screens as Array<{ id: string; name: string; purpose: string }>)
        .map((s) => `  • ${s.id}: ${s.purpose}`)
        .join("\n");
      productLines.push(`- Typical screens for this archetype:\n${list}`);
    }
  }

  const industryContext = industryLines.length
    ? `\n## Industry Reference (${s1.industry})\n${industryLines.join("\n")}`
    : "";

  const productContext = productLines.length
    ? `\n## Product Archetype (${s1.app_type} — ${s1.complexity})\n${productLines.join("\n")}`
    : "";

  // ── Theme tokens context ───────────────────────────────────────────────────
  const tk = s2.theme_tokens;
  const themeContext = tk
    ? `\n## Design Tokens (for LLM 3 screen generation)
- Background: ${tk.background}
- Primary: ${tk.primary}  Secondary: ${tk.secondary}  Accent: ${tk.accent}
- Surface: ${tk.surface}  Surface2: ${tk.surface2}  Border: ${tk.border}
- Text: ${tk.text}  Text muted: ${tk.text_muted}
- Heading font: ${tk.heading_font}  Body font: ${tk.body_font}
- Animation: ${tk.animation_speed} · ${tk.animation_style} · easing: ${tk.easing}
- Theme description: ${tk.desc}`
    : "";

  return `You are a senior product architect. Your task is to synthesize ALL the inputs below into a definitive screen plan for LLM 3, which will generate the actual UI screens.

## Parsed User Intent (extracted by LLM 1)
- App Purpose: ${intent.app_purpose}
- Primary Users: ${intent.primary_users}
- Core Value Proposition: ${intent.core_value_prop}
- Key User Flows: ${intent.key_user_flows.join(" | ")}
- Must-Have Features: ${intent.must_have_features.join(", ")}
- App Personality: ${intent.app_personality}
- Unique Differentiators: ${intent.unique_differentiators}
- Screens Implied by User: ${intent.implied_screens.join(", ") || "none specified"}
- Content Tone: ${intent.content_tone}

## App Brief
- App Name: ${s1.project_name}
- Industry: ${s1.industry}  App Type: ${s1.app_type}
- Project Type: ${s1.project_type}
- Complexity: ${s1.complexity} → generate ${screenCount.min}–${screenCount.max} screens
- Features selected: ${s1.features.length ? s1.features.join(", ") : "none"}
${industryContext}
${productContext}

## Visual Direction
- Style pack: ${s2.style_pack}
- Font pairing: ${s2.font_pairing}
- Screenshots uploaded: ${s2.screenshot_count > 0 ? `Yes (${s2.screenshot_count})` : "No"}
- Inspiration images: ${s2.inspiration_image_count > 0 ? `Yes (${s2.inspiration_image_count})` : "No"}
- Reference URLs: ${s2.reference_urls.length ? s2.reference_urls.join(", ") : "none"}
${themeContext}

## How to Think
1. Parsed User Intent is the ground truth — it is what the user actually wants to build.
2. Use Industry and Product reference sections as expert background knowledge only — not templates to copy.
3. If the user's description closely matches the product archetype → let archetype flows and patterns inform the structure, adapted to this specific app.
4. If the description is different → derive all screens entirely from the user intent.
5. Selected features are explicit user choices — every selected feature must be represented.
6. Your output is the definitive brief LLM 3 uses to generate each screen's HTML. Make it precise.

## Output Rules
- All screen names: lowercase snake_case (e.g. "booking_calendar", "product_detail").
- Always start with "splash" then "onboarding".
- nav_flow: source screen → direct child screens only.
- tab_bar: 3–5 items, must be actual screen names from your list.
- aesthetic/tone/motion: derived from style_pack "${s2.style_pack}" + app personality "${intent.app_personality}".
- primary_icons: valid snake_case icon names for this specific app.
- Every screen must serve a purpose from the user intent or selected features.

Output ONLY raw JSON (no markdown, no explanation, no code fences):
{
  "screens": ["screen_name", ...],
  "nav_flow": { "screen_name": ["child_screen", ...], ... },
  "tab_bar": ["screen_name", ...],
  "aesthetic": {
    "aesthetic": "two or three descriptive adjectives",
    "tone": "tone descriptors matching style pack and app personality",
    "motion": "animation style description"
  },
  "icons": {
    "set": "icon_category_name",
    "primary_icons": ["icon1", "icon2", "icon3", "icon4", "icon5"]
  }
}`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as RequestBody;
    const { s1, s2 } = body;

    if (!s1?.project_name || !s1?.industry) {
      return NextResponse.json(
        { error: "Missing required S1 fields: project_name, industry" },
        { status: 400 }
      );
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const model = process.env.MODEL ?? "claude-sonnet-4-6";

    // ── Log inputs ─────────────────────────────────────────────────────────
    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║          PIPELINE INPUT: SCREEN 1 (S1)          ║");
    console.log("╚══════════════════════════════════════════════════╝");
    console.log(JSON.stringify(s1, null, 2));

    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║          PIPELINE INPUT: SCREEN 2 (S2)          ║");
    console.log("╚══════════════════════════════════════════════════╝");
    console.log(JSON.stringify(s2, null, 2));

    // ══════════════════════════════════════════════════════════════════════
    // LLM 1 — User Intent Parser (claude-sonnet)
    // Input:  raw description + notes + basic S1 context
    // Output: ParsedIntent — structured understanding of what the user wants
    // ══════════════════════════════════════════════════════════════════════

    const llm1Prompt = buildLLM1IntentPrompt(s1);

    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║   LLM-1 PROMPT (User Intent Parser — sonnet)    ║");
    console.log("╚══════════════════════════════════════════════════╝");
    console.log(llm1Prompt);
    console.log("══════════════════════════════════════════════════\n");

    const llm1System = "You are a product analyst specializing in user intent parsing. Output only raw JSON. No markdown. No explanation. No code fences.";

    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║          LLM-1 SYSTEM PROMPT                    ║");
    console.log("╚══════════════════════════════════════════════════╝");
    console.log(llm1System);
    console.log("══════════════════════════════════════════════════\n");

    console.log("[LLM-1] Calling claude-sonnet — user intent parsing...");
    const llm1Start = Date.now();

    const llm1Response = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      system: llm1System,
      messages: [{ role: "user", content: llm1Prompt }],
    });

    const llm1Duration = Date.now() - llm1Start;
    const llm1Raw = llm1Response.content[0].type === "text" ? llm1Response.content[0].text : "{}";

    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║          LLM-1 RAW RESPONSE                     ║");
    console.log("╚══════════════════════════════════════════════════╝");
    console.log(`Duration: ${llm1Duration}ms | Tokens: in=${llm1Response.usage.input_tokens} out=${llm1Response.usage.output_tokens} | Stop: ${llm1Response.stop_reason}`);
    console.log(llm1Raw);
    console.log("══════════════════════════════════════════════════\n");

    let parsedIntent: ParsedIntent;
    try {
      parsedIntent = JSON.parse(llm1Raw) as ParsedIntent;
    } catch {
      console.error("[LLM-1] Failed to parse JSON:", llm1Raw);
      return NextResponse.json({ error: "LLM-1 returned invalid JSON" }, { status: 500 });
    }

    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║          LLM-1 OUTPUT: PARSED USER INTENT       ║");
    console.log("╚══════════════════════════════════════════════════╝");
    console.log(JSON.stringify(parsedIntent, null, 2));
    console.log("══════════════════════════════════════════════════\n");

    // ══════════════════════════════════════════════════════════════════════
    // LLM 2 — Screen Plan Builder (claude-sonnet)
    // Input:  ParsedIntent + all S1/S2 structured data (brains + theme tokens)
    // Output: LLMScreenPlan — definitive screen plan for LLM 3
    // ══════════════════════════════════════════════════════════════════════

    const llm2Prompt = buildLLM2PlanPrompt(s1, s2, parsedIntent);

    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║   LLM-2 PROMPT (Screen Plan Builder — sonnet)   ║");
    console.log("╚══════════════════════════════════════════════════╝");
    console.log(llm2Prompt);
    console.log("══════════════════════════════════════════════════\n");

    const llm2System = "You are a senior product architect. Output only raw JSON. No markdown. No explanation. No code fences.";

    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║          LLM-2 SYSTEM PROMPT                    ║");
    console.log("╚══════════════════════════════════════════════════╝");
    console.log(llm2System);
    console.log("══════════════════════════════════════════════════\n");

    console.log("[LLM-2] Calling claude-sonnet — screen plan synthesis...");
    const llm2Start = Date.now();

    const llm2Response = await anthropic.messages.create({
      model,
      max_tokens: 2048,
      system: llm2System,
      messages: [{ role: "user", content: llm2Prompt }],
    });

    const llm2Duration = Date.now() - llm2Start;
    const llm2Raw = llm2Response.content[0].type === "text" ? llm2Response.content[0].text : "{}";

    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║          LLM-2 RAW RESPONSE                     ║");
    console.log("╚══════════════════════════════════════════════════╝");
    console.log(`Duration: ${llm2Duration}ms | Tokens: in=${llm2Response.usage.input_tokens} out=${llm2Response.usage.output_tokens} | Stop: ${llm2Response.stop_reason}`);
    console.log(llm2Raw);
    console.log("══════════════════════════════════════════════════\n");

    let plan: LLMScreenPlan;
    try {
      plan = JSON.parse(llm2Raw) as LLMScreenPlan;
    } catch {
      console.error("[LLM-2] Failed to parse JSON:", llm2Raw);
      return NextResponse.json({ error: "LLM-2 returned invalid JSON" }, { status: 500 });
    }

    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║          LLM-2 OUTPUT: SCREEN PLAN              ║");
    console.log("╚══════════════════════════════════════════════════╝");
    console.log(`Screens (${plan.screens?.length ?? 0}): ${(plan.screens ?? []).join(", ")}`);
    console.log(`Tab bar: ${(plan.tab_bar ?? []).join(", ")}`);
    console.log(`Aesthetic: ${plan.aesthetic?.aesthetic}`);
    console.log(`Tone: ${plan.aesthetic?.tone}`);
    console.log(`Motion: ${plan.aesthetic?.motion}`);
    console.log(`Icons: ${plan.icons?.set} — ${plan.icons?.primary_icons?.join(", ")}`);
    console.log("Full plan:", JSON.stringify(plan, null, 2));
    console.log("══════════════════════════════════════════════════\n");

    // LLM 3 is generateScreen.ts — called separately per screen during generation

    return NextResponse.json({
      plan,
      parsedIntent,
      durationMs: llm1Duration + llm2Duration,
      usage: {
        llm1: {
          input:  llm1Response.usage.input_tokens,
          output: llm1Response.usage.output_tokens,
        },
        llm2: {
          input:  llm2Response.usage.input_tokens,
          output: llm2Response.usage.output_tokens,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[generate-screens-plan] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
