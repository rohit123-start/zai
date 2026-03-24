"use client";

import { useState } from "react";
import { ScreenPreview } from "@/components/zeach/ScreenPreview";
import { useScreenGenerator } from "@/hooks/useScreenGenerator";
import type { ZeachInputs } from "@/lib/zeach/buildPrompt";

const BASE_INPUTS: Omit<ZeachInputs, "targetScreen"> = {
  appName: "ProjectBrain",
  description:
    "A finance dashboard that helps banking teams and analysts describe their project using three lenses — industry context, product capabilities, and user requirements — and instantly generates structured, LLM-ready prompts that produce smarter financial previews, reports, and feature breakdowns from day one.",
  notes:
    "Built for finance and banking professionals. Users input three sections: industry brain (regulatory environment, market trends, competitor landscape), product brain (banking stack, compliance constraints, existing integrations), and user requirements (analyst workflows, reporting needs, risk monitoring). The dashboard distills these into structured prompts and outputs financial previews, KPI breakdowns, and compliance-aware feature specs.",
  industry: "finance_banking",
  appType: "Finance Dashboard",
  complexity: "Startup",
  features: [
    "Authentication",
    "Analytics / Dashboard",
    "Payments",
    "Notifications",
    "Search & Filters",
  ],
  stylePack: "Slate | professional, clean, structured",
  tone: "reliable, authoritative, trustworthy",
  colors: {
    text: "#0f172a",
    error: "#ef4444",
    accent: "#3b82f6",
    border: "#e2e8f0",
    primary: "#2563eb",
    success: "#10b981",
    surface: "#ffffff",
    warning: "#f59e0b",
    surface2: "#f1f4f9",
    secondary: "#93c5fd",
    background: "#f8f9fc",
    text_muted: "#64748b",
    primary_dark: "#1d4ed8",
    text_inverse: "#ffffff",
    primary_light: "#eff6ff",
  },
  typography: {
    scale: {
      h1: "28px",
      h2: "22px",
      h3: "18px",
      body: "15px",
      label: "11px",
      caption: "12px",
    },
    weights: { body: "400", heading: "700", emphasis: "600" },
    body_font: "Inter",
    heading_font: "Inter",
    line_heights: { body: "1.5", caption: "1.4", heading: "1.2" },
  },
  icons: {
    fill: 1,
    weight: "sharp",
    library: "material-symbols",
    fallback: "material-symbols-sharp",
    action_icons: ["add", "edit", "share", "more_horiz", "arrow_forward"],
    industry_set: "finance",
    primary_icons: [
      "account_balance",
      "credit_card",
      "payments",
      "savings",
      "trending_up",
    ],
    navigation_icons: ["home", "search", "calendar_today", "person"],
  },
  darkMode: false,
  globalTheme: {
    layout: {
      base: "desktop",
      grid: { mobile: "4-column", tablet: "8-column", desktop: "12-column" },
      container_width: { mobile: "100%", tablet: "960px", desktop: "1200px" },
    },
    radius: {
      lg: "16px",
      md: "12px",
      sm: "8px",
      xl: "20px",
      xxl: "24px",
      pill: "999px",
    },
    shadows: {
      lg: "0 8px 32px rgba(0,0,0,0.14)",
      md: "0 4px 16px rgba(0,0,0,0.10)",
      sm: "0 1px 4px rgba(0,0,0,0.06)",
    },
    navigation: { mobile: "bottom_tab", tablet: "collapsed_sidebar", desktop: "sidebar" },
    breakpoints: {
      mobile: "768px",
      tablet: "1024px",
      desktop: "1280px",
    },
  },
};

const SCREEN_OPTIONS = [
  "dashboard",
  "login",
  "signup",
  "transactions",
  "analytics",
  "payments",
  "profile",
  "settings",
  "notifications",
  "search",
];

export default function CanvasPage() {
  const { html, isLoading, error, durationMs, usage, generate, reset } =
    useScreenGenerator();
  const [targetScreen, setTargetScreen] = useState("dashboard");
  const [layoutBase, setLayoutBase] = useState<"mobile" | "desktop">("desktop");

  const handleGenerate = () => {
    generate({ ...BASE_INPUTS, targetScreen });
  };

  return (
    <div
      style={{ display: "flex", height: "100vh", background: "#0a0a0f", color: "#fff", fontFamily: "var(--font-dm-sans, sans-serif)" }}
    >
      {/* ── Left panel ── */}
      <div
        style={{
          width: 280,
          flexShrink: 0,
          borderRight: "1px solid rgba(255,255,255,0.07)",
          background: "#0d0d14",
          padding: "24px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          overflowY: "auto",
        }}
      >
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#e2e8f0" }}>
            Zeach Canvas
          </h1>
          <p style={{ fontSize: 12, color: "#475569", margin: "4px 0 0" }}>
            Screen generation pipeline
          </p>
        </div>

        {/* Screen selector */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>
            Target screen
          </label>
          <select
            value={targetScreen}
            onChange={(e) => setTargetScreen(e.target.value)}
            style={{
              background: "#141420",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              color: "#e2e8f0",
              padding: "10px 12px",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {SCREEN_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        {/* Layout toggle */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>
            Preview layout
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {(["desktop", "mobile"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setLayoutBase(mode)}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 8,
                  border: "1px solid",
                  borderColor: layoutBase === mode ? "#06b6d4" : "rgba(255,255,255,0.1)",
                  background: layoutBase === mode ? "rgba(6,182,212,0.1)" : "transparent",
                  color: layoutBase === mode ? "#06b6d4" : "#64748b",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 150ms",
                  textTransform: "capitalize",
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={isLoading}
          style={{
            padding: "13px 0",
            background: isLoading ? "#1e3a5f" : "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            cursor: isLoading ? "not-allowed" : "pointer",
            transition: "background 150ms",
          }}
        >
          {isLoading ? "Generating…" : `Generate "${targetScreen}"`}
        </button>

        {html && !isLoading && (
          <button
            onClick={reset}
            style={{
              padding: "10px 0",
              background: "transparent",
              color: "#64748b",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              padding: "12px 14px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 10,
              fontSize: 12,
              color: "#fca5a5",
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        {/* Stats */}
        {durationMs && !isLoading && (
          <div
            style={{
              padding: "12px 14px",
              background: "rgba(6,182,212,0.06)",
              border: "1px solid rgba(6,182,212,0.15)",
              borderRadius: 10,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
              Last generation
            </div>
            <div style={{ fontSize: 13, color: "#94a3b8" }}>
              ⏱ {(durationMs / 1000).toFixed(1)}s
            </div>
            {usage && (
              <div style={{ fontSize: 12, color: "#64748b" }}>
                in: {usage.input?.toLocaleString()} · out: {usage.output?.toLocaleString()} tokens
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Preview pane ── */}
      <div style={{ flex: 1, padding: 32, overflow: "hidden" }}>
        <ScreenPreview
          html={html}
          isLoading={isLoading}
          layoutBase={layoutBase}
        />
      </div>
    </div>
  );
}
