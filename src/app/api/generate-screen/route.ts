import { NextRequest, NextResponse } from "next/server";
import { generateScreen } from "@/lib/zeach/generateScreen";
import type { ZeachInputs } from "@/lib/zeach/buildPrompt";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ZeachInputs;

    if (!body.appName || !body.targetScreen) {
      return NextResponse.json(
        { error: "Missing required fields: appName, targetScreen" },
        { status: 400 }
      );
    }

    console.log(
      `[generate-screen] ${body.appName} → "${body.targetScreen}" (${body.complexity})`
    );

    const result = await generateScreen(body);

    if (result.error) {
      console.error("[generate-screen] error:", result.error);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    console.log(
      `[generate-screen] done in ${result.durationMs}ms | in:${result.inputTokens} out:${result.outputTokens}`
    );

    return NextResponse.json({
      html: result.html,
      durationMs: result.durationMs,
      screen: body.targetScreen,
      usage: {
        input: result.inputTokens,
        output: result.outputTokens,
      },
    });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
