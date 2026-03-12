import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const EXTRACT_PROMPT = `You are a design systems expert. Analyze the provided HTML artifact and extract its complete design guideline as a single structured JSON object.

Return ONLY valid JSON — no markdown fences, no explanation — in exactly this schema:

{
  "meta": {
    "product": "<product/app name from the artifact>",
    "version": "1.0",
    "theme": "<design theme e.g. fintech premium, saas minimal>",
    "mood": "<comma-separated mood words e.g. modern, professional, trustworthy>",
    "avoid_globally": ["<anti-pattern found to be absent>", ...]
  },
  "colors": {
    "primary": "<hex>",
    "secondary": "<hex or null>",
    "cta": "<hex>",
    "cta_hover": "<hex or null>",
    "bg_primary": "<hex>",
    "bg_secondary": "<hex or null>",
    "text_primary": "<hex>",
    "text_secondary": "<hex or null>",
    "text_tertiary": "<hex or null>",
    "border": "<hex or null>",
    "success": "<hex or null>",
    "error": "<hex or null>",
    "gradients": {},
    "rules": ["<color usage rule>", ...]
  },
  "typography": {
    "family": "<font-stack>",
    "weights_allowed": [<numbers>],
    "hierarchy": {
      "h1": { "size": "<px>", "weight": <number>, "line_height": <number>, "usage": "<when to use>" },
      "h2": { "size": "<px>", "weight": <number>, "line_height": <number>, "usage": "<when to use>" },
      "h3": { "size": "<px>", "weight": <number>, "line_height": <number>, "usage": "<when to use>" },
      "body": { "size": "<px>", "weight": <number>, "line_height": <number>, "usage": "<when to use>" },
      "label": { "size": "<px>", "weight": <number>, "line_height": <number>, "usage": "<when to use>" },
      "button": { "size": "<px>", "weight": <number>, "line_height": <number>, "usage": "<when to use>" },
      "nav": { "size": "<px>", "weight": <number>, "line_height": <number>, "usage": "<when to use>" }
    },
    "rules": ["<typography rule>", ...]
  },
  "spacing": {
    "base_unit": "<px>",
    "scale": [<numbers>],
    "specific": {
      "<area>": "<value>",
      ...
    },
    "rules": ["<spacing rule>", ...]
  },
  "layout": {
    "grid": "<layout approach>",
    "container": "<container strategy>",
    "hero": {
      "display": "<flex|grid>",
      "justify": "<value>",
      "align": "<value>",
      "left_max_width": "<px or null>",
      "right_size": "<WxH or null>"
    },
    "z_index_scale": { "base": 0, "nav": 100 },
    "rules": ["<layout rule>", ...]
  },
  "components": {
    "<component_name>": {
      "bg": "<hex or transparent>",
      "color": "<hex>",
      "padding": "<value>",
      "radius": "<value>",
      "font": "<size/weight>",
      "shadow": "<value or null>",
      "hover_bg": "<hex or null>",
      "hover_transform": "<value or null>",
      "transition": "<value>"
    },
    ...
  },
  "effects": {
    "shadows": { "<name>": "<value>", "max_blur_allowed": "<px>" },
    "border_radius": { "<element>": "<px>", "max_allowed": "<px>" },
    "animations": {
      "<name>": "<spec>",
      "default_duration": "<s>",
      "default_easing": "<value>"
    },
    "backgrounds": {},
    "rules": ["<effects rule>", ...]
  },
  "accessibility": {
    "contrast": "<rule>",
    "html": "<rule>",
    "min_touch_target": "<size>"
  },
  "responsive": {
    "breakpoints": { "mobile": "375px", "tablet": "768px", "desktop": "1280px" },
    "rules": ["<responsive rule>", ...]
  }
}

Extract only values actually present in the HTML. Use null for anything not found. Be precise with hex codes and pixel values.`;

export async function POST(request: Request) {
  try {
    const { artifactHtml, projectId, userId } = await request.json();

    if (!artifactHtml || !projectId || !userId) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `${EXTRACT_PROMPT}\n\nHTML Artifact:\n\`\`\`html\n${artifactHtml}\n\`\`\``,
        },
      ],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonStr = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(jsonStr);

    const dg = JSON.stringify(parsed, null, 2);

    const supabase = await createClient();
    const { data, error: dbErr } = await supabase
      .from("design_guidelines")
      .upsert(
        {
          project_id: projectId,
          user_id: userId,
          compressed_dg: dg,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "project_id" }
      )
      .select()
      .single();

    if (dbErr) throw dbErr;

    // Track token usage (fire-and-forget)
    supabase.from("token_usage").insert({
      project_id: projectId,
      user_id: userId,
      endpoint: "dg/extract",
      model: "claude-haiku-4-5",
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    }).then(({ error }) => { if (error) console.error("[token_usage dg/extract]", error); });

    return Response.json({ dg: data.compressed_dg });
  } catch (err) {
    console.error("[dg/extract]", err);
    return Response.json({ error: "Failed to extract design guidelines" }, { status: 500 });
  }
}
