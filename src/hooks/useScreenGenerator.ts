"use client";

import { useState, useCallback } from "react";
import type { ZeachInputs } from "@/lib/zeach/buildPrompt";

interface GeneratorState {
  html: string;
  isLoading: boolean;
  error: string | null;
  durationMs: number | null;
  lastScreen: string | null;
  usage: { input?: number; output?: number } | null;
}

const INITIAL_STATE: GeneratorState = {
  html: "",
  isLoading: false,
  error: null,
  durationMs: null,
  lastScreen: null,
  usage: null,
};

export function useScreenGenerator() {
  const [state, setState] = useState<GeneratorState>(INITIAL_STATE);

  const generate = useCallback(async (inputs: ZeachInputs) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const res = await fetch("/api/generate-screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputs),
      });

      const data = await res.json() as {
        html?: string;
        error?: string;
        durationMs?: number;
        screen?: string;
        usage?: { input?: number; output?: number };
      };

      if (!res.ok || data.error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: data.error ?? "Generation failed",
        }));
        return;
      }

      setState({
        html: data.html ?? "",
        isLoading: false,
        error: null,
        durationMs: data.durationMs ?? null,
        lastScreen: data.screen ?? null,
        usage: data.usage ?? null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Network error";
      setState((prev) => ({ ...prev, isLoading: false, error: message }));
    }
  }, []);

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  return { ...state, generate, reset };
}
