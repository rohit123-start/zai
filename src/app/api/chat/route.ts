import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "@/lib/systemPrompt";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { messages, dgContext } = await request.json();

    // Inject project design guidelines into the system prompt when available
    const system = dgContext
      ? `${SYSTEM_PROMPT}\n\n## Project Design Guidelines\nThis project has established design guidelines. Follow them precisely when generating or editing artifacts:\n\n${dgContext}`
      : SYSTEM_PROMPT;

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
          const response = await anthropic.messages.stream({
            model: "claude-sonnet-4-6",
            max_tokens: 32000,
            system,
            messages,
          });

          for await (const chunk of response) {
            if (controllerClosed) break;
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
