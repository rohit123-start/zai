import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYNC_PROMPT = `You are a design systems expert. Compare the existing design guideline with a newly generated HTML artifact.

Determine if the new artifact introduces meaningful design changes — new colors, fonts, spacing values, component styles, animations, or layout patterns — that require updating the stored guideline.

Minor changes (text edits, content swaps, trivial color tweaks to a single element) do NOT warrant an update.

If the design has meaningfully changed, return the FULL updated guideline in the same schema, as valid JSON (no markdown fences):
{
  "changed": true,
  "dg": {
    "meta": { "product": "...", "version": "1.0", "theme": "...", "mood": "...", "avoid_globally": [...] },
    "colors": { "primary": "...", "secondary": "...", "cta": "...", "cta_hover": "...", "bg_primary": "...", "bg_secondary": "...", "text_primary": "...", "text_secondary": "...", "text_tertiary": "...", "border": "...", "success": null, "error": null, "gradients": {}, "rules": [...] },
    "typography": { "family": "...", "weights_allowed": [...], "hierarchy": { "h1": { "size": "...", "weight": 0, "line_height": 0, "usage": "..." }, "h2": {}, "h3": {}, "body": {}, "label": {}, "button": {}, "nav": {} }, "rules": [...] },
    "spacing": { "base_unit": "...", "scale": [...], "specific": {}, "rules": [...] },
    "layout": { "grid": "...", "container": "...", "hero": {}, "z_index_scale": {}, "rules": [...] },
    "components": {},
    "effects": { "shadows": {}, "border_radius": {}, "animations": {}, "backgrounds": {}, "rules": [...] },
    "accessibility": {},
    "responsive": { "breakpoints": {}, "rules": [...] }
  }
}

If the design is essentially unchanged, return:
{ "changed": false }

Return ONLY valid JSON. No explanation. No markdown.`;

export async function POST(request: Request) {
  try {
    const { artifactHtml, currentDg, projectId, userId } = await request.json();

    if (!artifactHtml || !projectId || !userId) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `${SYNC_PROMPT}

Existing design guideline:
${currentDg ?? "(none)"}

New HTML artifact:
\`\`\`html
${artifactHtml}
\`\`\``,
        },
      ],
    });

    const raw =
      response.content[0].type === "text" ? response.content[0].text : '{"changed":false}';
    const jsonStr = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(jsonStr) as { changed: false } | { changed: true; dg: object };

    if (!parsed.changed) {
      return Response.json({ changed: false });
    }

    const dgStr = JSON.stringify(parsed.dg, null, 2);

    const supabase = await createClient();
    const { data, error: dbErr } = await supabase
      .from("design_guidelines")
      .upsert(
        {
          project_id: projectId,
          user_id: userId,
          compressed_dg: dgStr,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "project_id" }
      )
      .select()
      .single();

    if (dbErr) throw dbErr;

    return Response.json({ changed: true, dg: data.compressed_dg });
  } catch (err) {
    console.error("[dg/sync]", err);
    return Response.json({ changed: false });
  }
}
