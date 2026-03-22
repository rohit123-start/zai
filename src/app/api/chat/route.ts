import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, buildBrainContext } from "@/lib/systemPrompt";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { messages, dgContext, currentPages, currentFiles, brain, projectId, userId } = await request.json();

    // ── Build system prompt ───────────────────────────────────────────────────
    let system = SYSTEM_PROMPT;

    // Inject project brain (primary context — design tokens, icons, screens, etc.)
    if (brain) {
      const brainCtx = buildBrainContext(brain as Record<string, unknown>);
      if (brainCtx) {
        system += `\n\n${brainCtx}`;
      }
    }

    // Inject design guidelines (legacy fallback)
    if (dgContext) {
      system += `\n\n## Additional Design Guidelines\n${dgContext}`;
    }

    // Inject current project state (pages/files from DB).
    // This replaces having full HTML in the message history.
    if (currentFiles && currentFiles.length > 0) {
      const pageFiles = currentFiles.filter((f: { path: string; content: string }) =>
        f.path.startsWith("pages/") && f.path.endsWith(".html")
      );
      const otherFiles = currentFiles.filter((f: { path: string; content: string }) =>
        !f.path.startsWith("pages/") || !f.path.endsWith(".html")
      );
      if (pageFiles.length > 0 || otherFiles.length > 0) {
        system += "\n\n## Current Project Files\nThese are the latest versions of all files. When editing, output only the changed file(s).\n";
        // Pages first
        for (const f of pageFiles) {
          system += `\n--- FILE: ${f.path} ---\n${f.content}\n`;
        }
        // Supporting files (css, js, components) truncated if huge
        for (const f of otherFiles) {
          const preview = f.content.length > 2000
            ? f.content.slice(0, 2000) + "\n/* …truncated… */"
            : f.content;
          system += `\n--- FILE: ${f.path} ---\n${preview}\n`;
        }
      }
    } else if (currentPages && currentPages.length > 0) {
      system += "\n\n## Current Project Pages\nThese are the latest versions. When editing, output only the changed page(s).\n";
      for (const pg of currentPages as { name: string; html: string }[]) {
        system += `\n--- ${pg.name}.html ---\n${pg.html}\n`;
      }
    }

    const encoder = new TextEncoder();
    let controllerClosed = false;

    const stream = new ReadableStream({
      async start(controller) {
        const safeEnqueue = (chunk: Uint8Array) => {
          if (!controllerClosed) {
            try {
              controller.enqueue(chunk);
            } catch {
              controllerClosed = true;
            }
          }
        };

        const safeClose = () => {
          if (!controllerClosed) {
            controllerClosed = true;
            try {
              controller.close();
            } catch {
              // already closed
            }
          }
        };

        try {
          // Detect if request likely needs a large artifact output
          const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === "user");
          const lastContent = typeof lastUserMsg?.content === "string"
            ? lastUserMsg.content
            : JSON.stringify(lastUserMsg?.content ?? "");

          // Initial project generation: "Build the **X** app." prompt
          const isInitialGeneration = /^Build the \*\*/.test(lastContent.trimStart());
          // Any artifact-producing request (edit, add page, etc.)
          const isArtifactRequest = isInitialGeneration || /build|create|make|design|generate|add page|update|fix|change/i.test(lastContent);

          // Token budget: initial generation needs the most room
          const maxTokens = 128000;

          // Extended thinking: enabled for initial generation so the model validates
          // the brain, resolves design inconsistencies, and plan before writing HTML.
          // budget_tokens is reserved within maxTokens for the thinking process.
          const thinkingBudget = 20000

          const startMs = Date.now();
          const response = await anthropic.messages.stream({
            model: "claude-sonnet-4-6",
            max_tokens: maxTokens,
            system,
            messages,
            ...(thinkingBudget > 0
              ? { thinking: { type: "enabled" as const, budget_tokens: thinkingBudget } }
              : {}),
          });

          // ── Keepalive ping during silent thinking phase ─────────────────────
          // SSE connections drop if nothing is sent for ~30-60s. During the
          // thinking phase no text flows, so we send a keepalive comment every
          // 4 seconds to keep the connection (and the client UI) alive.
          let keepaliveInterval: ReturnType<typeof setInterval> | null = null;
          const startKeepalive = () => {
            if (keepaliveInterval) return;
            keepaliveInterval = setInterval(() => {
              safeEnqueue(encoder.encode(": keepalive\n\n"));
            }, 4000);
          };
          const stopKeepalive = () => {
            if (keepaliveInterval) {
              clearInterval(keepaliveInterval);
              keepaliveInterval = null;
            }
          };

          for await (const chunk of response) {
            if (controllerClosed) break;

            // Track block transitions to signal status to the client
            if (chunk.type === "content_block_start") {
              const blockType = (chunk.content_block as { type: string }).type;
              if (blockType === "thinking") {
                // Thinking started — keep connection alive with pings
                startKeepalive();
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({ status: "thinking" })}\n\n`));
              } else if (blockType === "text") {
                // Text output starting — stop keepalive, signal generating
                stopKeepalive();
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({ status: "generating" })}\n\n`));
              }
            }

            // Only forward text deltas — thinking content stays server-side
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              safeEnqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`
                )
              );
            }
          }

          stopKeepalive();

          // Log + persist token usage
          const finalMsg = await response.finalMessage();
          const usage = finalMsg.usage;
          const elapsed = Date.now() - startMs;
          // cache_read_input_tokens / cache_creation_input_tokens are optional fields
          const usageExt = usage as typeof usage & { cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
          console.log(
            `[chat] ${elapsed}ms | in:${usage.input_tokens} out:${usage.output_tokens} | max:${maxTokens}${thinkingBudget ? ` | thinking_budget:${thinkingBudget}` : ""}${usageExt.cache_read_input_tokens ? ` | cache_read:${usageExt.cache_read_input_tokens}` : ""}`
          );

          // Save to DB (fire-and-forget — don't block the response)
          if (projectId && userId) {
            createClient().then((supabase) =>
              supabase.from("token_usage").insert({
                project_id: projectId,
                user_id: userId,
                endpoint: "chat",
                model: "claude-sonnet-4-6",
                input_tokens: usage.input_tokens,
                output_tokens: usage.output_tokens,
              }).then(({ error }) => {
                if (error) console.error("[token_usage insert]", error);
              })
            );
          }

          // Send usage back to client so UI can display it live
          safeEnqueue(
            encoder.encode(
              `data: ${JSON.stringify({ usage: { input: usage.input_tokens, output: usage.output_tokens } })}\n\n`
            )
          );

          safeEnqueue(encoder.encode("data: [DONE]\n\n"));
          safeClose();
        } catch (err) {
          // Ignore abort errors from client disconnect
          const isAbort =
            err instanceof Error &&
            (err.name === "AbortError" || err.message.includes("closed"));
          if (!isAbort) {
            console.error("[chat/route] stream error:", err);
          }
          safeClose();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
