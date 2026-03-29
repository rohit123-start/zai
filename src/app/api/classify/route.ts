import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

// ─── Model ────────────────────────────────────────────────────────────────────

const HAIKU = "claude-haiku-4-5";

// ─── Types ────────────────────────────────────────────────────────────────────

interface S1Input {
  project_name: string;
  description: string;
  industry: string;
  app_type: string;
  project_type: string;
  features: string[];
}

interface Classification {
  industry_signal: { detected: string; confidence: string; keywords_matched: string[]; user_selected: string; match: boolean };
  app_type_signal:  { detected: string; confidence: string; keywords_matched: string[]; user_selected: string; match: boolean };
  complexity_inferred: "simple" | "mid" | "complex";
  complexity_reason: string;
  app_structure: "single_sided" | "two_sided" | "multi_tenant";
  mismatches: string[];
  proceed: boolean;
  proceed_reason: string;
}

interface DomainExtraction {
  domain_entities: { name: string; fields: string[] }[];
  product_vocabulary: {
    primary_object: string;
    action_verb: string;
    user_title: string;
    owner_title?: string;
    key_differentiator: string;
  };
  screen_content_hints: Record<string, string>;
  what_makes_this_specific: string[];
  features: {
    explicit: string[];
    inferred: string[];
    irrelevant: string[];
    on_demand: string[];
  };
  custom_features: unknown[];
  tone_hints: string[];
  enriched_notes: string;
}

interface RequestBody {
  projectId: string;
  userId: string;
  s1: S1Input;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractJson(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = s.indexOf("{");
  const end   = s.lastIndexOf("}");
  if (start !== -1 && end > start) return s.slice(start, end + 1);
  return s;
}

function getAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

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
  const { error } = await supabase.from("pipeline_runs").update(updates).eq("id", runId);
  if (error) {
    console.error(`[classify:updateRun] ✗ keys=[${Object.keys(updates).join(",")}] | ${error.message}`);
  }
}

async function appendLog(runId: string, entry: Record<string, unknown>): Promise<void> {
  try {
    const supabase = getAdminClient();
    const row = { ...entry, ts: new Date().toISOString() };
    const { error } = await supabase.rpc("pipeline_run_append_log", { run_id: runId, entry: row });
    if (error) console.error(`[classify:appendLog] ✗ step=${entry.step} | ${error.message}`);
  } catch (e) {
    console.error(`[classify:appendLog] ✗ step=${entry.step} | unexpected:`, e);
  }
}

// ─── Feature label normaliser ──────────────────────────────────────────────────

function featureToFile(name: string): string {
  return name.toLowerCase()
    .replace(/[&\/]/g, "_").replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "").replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let runId = "";

  try {
    const body = await req.json() as RequestBody;
    const { projectId, userId, s1 } = body;

    if (!projectId || !userId || !s1?.project_name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 01 — Create pipeline run record
    // ──────────────────────────────────────────────────────────────────────────

    const step01Input = {
      s1,
      brain_keys: {
        industry_brain: s1.industry.toLowerCase().replace(/\s+/g, "_"),
        product_brain:  s1.app_type.toLowerCase().replace(/\s+/g, "_"),
        feature_modules: s1.features.map(featureToFile),
      },
    };

    runId = await createPipelineRun(projectId, userId, step01Input);
    console.log(`[classify] ▶ run ${runId} | ${s1.project_name} | ${s1.industry} × ${s1.app_type}`);

    appendLog(runId, {
      step: "01",
      status: "ok",
      msg: `Classify run started | industry=${s1.industry} app_type=${s1.app_type}`,
    });

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 01.5a — AI Classification (Haiku)
    // ──────────────────────────────────────────────────────────────────────────

    const classificationPrompt = `Validate these app selections against the description and return structured JSON.

Description: "${s1.description}"

User selected:
- Industry: ${s1.industry}
- App Type: ${s1.app_type}
- Features selected: ${s1.features.length ? s1.features.join(", ") : "none"}

Return JSON with exactly these keys:
{
  "industry_signal": {
    "detected": "string — industry detected from description",
    "confidence": "high | medium | low",
    "keywords_matched": ["array of keywords found"],
    "user_selected": "${s1.industry}",
    "match": true | false
  },
  "app_type_signal": {
    "detected": "string — app type detected from description",
    "confidence": "high | medium | low",
    "keywords_matched": ["array of keywords found"],
    "user_selected": "${s1.app_type}",
    "match": true | false
  },
  "complexity_inferred": "simple | mid | complex",
  "complexity_reason": "string — one sentence explaining why",
  "app_structure": "single_sided | two_sided | multi_tenant",
  "mismatches": ["array of mismatch descriptions — empty array if none"],
  "proceed": true | false,
  "proceed_reason": "string — only if proceed is false, else empty string"
}

Complexity rules:
- simple: Single user type. Linear flow. 5–8 screens implied.
- mid: One or two user types. Multiple flows. 10–16 screens implied.
- complex: Multiple user types or roles. Complex workflows. 17+ screens implied.

If match is false on either industry or app_type — set proceed: false and explain in proceed_reason.`;

    const s015aStart = Date.now();
    console.log(`[classify] 01.5a Haiku classification…`);

    const classRes = await anthropic.messages.create({
      model: HAIKU,
      max_tokens: 600,
      system: "You are a product classification engine. Return ONLY valid JSON. No commentary. No markdown.",
      messages: [{ role: "user", content: classificationPrompt }],
    });

    const s015aDuration = Date.now() - s015aStart;
    const classRaw = classRes.content[0].type === "text" ? classRes.content[0].text : "{}";

    let classification: Classification;
    try {
      classification = JSON.parse(extractJson(classRaw)) as Classification;
    } catch {
      classification = {
        industry_signal: { detected: s1.industry, confidence: "high", keywords_matched: [], user_selected: s1.industry, match: true },
        app_type_signal:  { detected: s1.app_type,  confidence: "high", keywords_matched: [], user_selected: s1.app_type,  match: true },
        complexity_inferred: "mid",
        complexity_reason: "Fallback — could not parse classification response",
        app_structure: "single_sided",
        mismatches: [],
        proceed: true,
        proceed_reason: "",
      };
    }

    console.log(`[classify] 01.5a ✓ ${s015aDuration}ms | complexity=${classification.complexity_inferred} proceed=${classification.proceed}`);
    await updateRun(runId, { step_015a_output: classification });
    appendLog(runId, {
      step: "01.5a",
      status: classification.proceed ? "ok" : "error",
      msg: classification.proceed
        ? `Classified | complexity=${classification.complexity_inferred} structure=${classification.app_structure}`
        : `Blocked — ${classification.proceed_reason}`,
      duration_ms: s015aDuration,
      tokens: { in: classRes.usage.input_tokens, out: classRes.usage.output_tokens },
    });

    if (!classification.proceed) {
      await updateRun(runId, {
        status: "failed",
        error_log: { message: classification.proceed_reason, step: "01.5a" },
        completed_at: new Date().toISOString(),
      });
      return NextResponse.json(
        { error: classification.proceed_reason, step: "01.5a", mismatches: classification.mismatches },
        { status: 422 }
      );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 01.5b — AI Domain DNA Extraction (Haiku)
    // ──────────────────────────────────────────────────────────────────────────

    const AVAILABLE_FEATURES = [
      "Authentication", "Payments", "Chat / Messaging", "Notifications",
      "Search & Filters", "Maps / Location", "Analytics / Dashboard",
      "File Upload", "Video / Calls",
    ];

    const extractionPrompt = `Extract the domain DNA and classify features for this product.

Description: "${s1.description}"
Industry: ${s1.industry}
App Type: ${s1.app_type}
Complexity: ${classification.complexity_inferred}
App structure: ${classification.app_structure}
Features user selected: ${s1.features.length ? s1.features.join(", ") : "none"}

Available features: ${AVAILABLE_FEATURES.join(", ")}

Return JSON with exactly these keys:
{
  "domain_entities": [
    { "name": "string", "fields": ["specific field names"] }
  ],
  "product_vocabulary": {
    "primary_object": "string",
    "action_verb": "string",
    "user_title": "string",
    "owner_title": "string (if two-sided, else omit)",
    "key_differentiator": "string — one sentence"
  },
  "screen_content_hints": {
    "[screen_id]": "what this screen should show"
  },
  "what_makes_this_specific": ["2-4 specific insights"],
  "features": {
    "explicit": ["user selected features"],
    "inferred": ["strongly implied features"],
    "irrelevant": ["clearly not needed"],
    "on_demand": ["might be needed later"]
  },
  "custom_features": [],
  "tone_hints": ["2-3 tone observations"],
  "enriched_notes": "2-3 sentences synthesising key product context"
}`;

    const s015bStart = Date.now();
    console.log(`[classify] 01.5b Haiku domain extraction…`);

    const extractRes = await anthropic.messages.create({
      model: HAIKU,
      max_tokens: 1000,
      system: "You are a product domain extraction engine. Return ONLY valid JSON. No commentary. No markdown.",
      messages: [{ role: "user", content: extractionPrompt }],
    });

    const s015bDuration = Date.now() - s015bStart;
    const extractRaw = extractRes.content[0].type === "text" ? extractRes.content[0].text : "{}";

    let extraction: DomainExtraction;
    try {
      extraction = JSON.parse(extractJson(extractRaw)) as DomainExtraction;
    } catch {
      extraction = {
        domain_entities: [],
        product_vocabulary: { primary_object: "", action_verb: "", user_title: "user", key_differentiator: s1.description },
        screen_content_hints: {},
        what_makes_this_specific: [],
        features: { explicit: s1.features, inferred: [], irrelevant: [], on_demand: [] },
        custom_features: [],
        tone_hints: [],
        enriched_notes: s1.description,
      };
    }

    console.log(`[classify] 01.5b ✓ ${s015bDuration}ms | entities=${extraction.domain_entities.length}`);
    await updateRun(runId, { step_015b_output: extraction });
    appendLog(runId, {
      step: "01.5b",
      status: "ok",
      msg: `Domain DNA extracted | entities=${extraction.domain_entities.length} hints=${Object.keys(extraction.screen_content_hints).length}`,
      duration_ms: s015bDuration,
      tokens: { in: extractRes.usage.input_tokens, out: extractRes.usage.output_tokens },
    });

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 01.5c — Context Quality Gate (pure code)
    // ──────────────────────────────────────────────────────────────────────────

    // ── Mark as classified — ready for Screen 2 ────────────────────────────
    await updateRun(runId, {
      status: "classified",
      total_tokens: {
        step_015a: { in: classRes.usage.input_tokens, out: classRes.usage.output_tokens },
        step_015b: { in: extractRes.usage.input_tokens, out: extractRes.usage.output_tokens },
      },
    });

    appendLog(runId, {
      step: "classify_complete",
      status: "ok",
      msg: `Classify complete | complexity=${classification.complexity_inferred} | awaiting visual direction`,
    });

    console.log(`[classify] ✓ DONE | runId=${runId} | complexity=${classification.complexity_inferred}`);

    return NextResponse.json({
      pipelineRunId: runId,
      complexity_inferred: classification.complexity_inferred,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[classify] ✗ ERROR:", message);
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
