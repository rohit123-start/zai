export interface ZeachInputs {
  // Screen 1
  appName: string;
  description: string;
  notes: string;
  industry: string;
  appType: string;
  complexity: "MVP" | "Startup" | "Scale";
  features: string[];

  // Screen 2
  stylePack: string;
  tone: string;
  colors: Record<string, string>;
  typography: {
    scale: Record<string, string>;
    weights: Record<string, string>;
    body_font: string;
    heading_font: string;
    line_heights: Record<string, string>;
  };
  icons: {
    fill: number;
    weight: string;
    library: string;
    fallback: string;
    action_icons: string[];
    industry_set: string;
    primary_icons: string[];
    navigation_icons: string[];
  };
  darkMode: boolean;

  // Theme
  globalTheme: Record<string, unknown>;

  // Generation target
  targetScreen: string;
}

// ─── Brain → ZeachInputs converter ───────────────────────────────────────────
export function brainToInputs(
  brain: Record<string, unknown>,
  targetScreen: string
): ZeachInputs {
  const p = (brain.project ?? {}) as Record<string, unknown>;
  const dt = (brain.design_tokens ?? {}) as Record<string, unknown>;
  const icons = (brain.icons ?? {}) as Record<string, unknown>;
  const stylePack = (brain.style_pack ?? {}) as Record<string, string>;
  const capsules = (brain.capsules ?? {}) as Record<string, boolean>;
  const typo = (dt.typography ?? {}) as Record<string, unknown>;

  return {
    appName: (p.name as string) ?? "App",
    description: (p.description as string) ?? "",
    notes: (p.notes as string) ?? "",
    industry: (p.industry as string) ?? "",
    appType: (p.app_type as string) ?? (p.type as string) ?? "",
    complexity: ((p.complexity as string) ?? "MVP") as ZeachInputs["complexity"],
    features: Array.isArray(p.features) ? (p.features as string[]) : [],
    stylePack: stylePack.name ?? "",
    tone: stylePack.tone ?? "",
    colors: (dt.colors ?? {}) as Record<string, string>,
    typography: {
      scale: (typo.scale as Record<string, string>) ?? {},
      weights: (typo.weights as Record<string, string>) ?? {},
      body_font: (typo.body_font as string) ?? "Inter",
      heading_font: (typo.heading_font as string) ?? "Inter",
      line_heights: (typo.line_heights as Record<string, string>) ?? {},
    },
    icons: {
      fill: (icons.fill as number) ?? 0,
      weight: (icons.weight as string) ?? "outlined",
      library: (icons.library as string) ?? "material-symbols",
      fallback: (icons.fallback as string) ?? "material-symbols-outlined",
      action_icons: Array.isArray(icons.action_icons) ? (icons.action_icons as string[]) : [],
      industry_set: (icons.industry_set as string) ?? "",
      primary_icons: Array.isArray(icons.primary_icons) ? (icons.primary_icons as string[]) : [],
      navigation_icons: Array.isArray(icons.navigation_icons) ? (icons.navigation_icons as string[]) : [],
    },
    darkMode: !!capsules.dark_mode,
    globalTheme: (brain.global_theme ?? {}) as Record<string, unknown>,
    targetScreen,
  };
}

export function buildPrompt(inputs: ZeachInputs): string {
  const layoutBase =
    (
      (inputs.globalTheme?.layout as Record<string, unknown>)
        ?.base as string
    ) ?? "mobile";

  return `
## CRITICAL — WHAT YOU ARE BUILDING
You are generating the "${inputs.targetScreen}" screen of the end-user application called "${inputs.appName}".
You are building what the USERS OF THIS APP see — NOT a tool that creates apps, NOT a project builder, NOT a prompt generator.
The description below explains what the app does for its users. Build THAT product's screen.

## Project
- App name:    ${inputs.appName}
- Target screen: ${inputs.targetScreen}
- Complexity:  ${inputs.complexity}
- Dark mode:   ${inputs.darkMode}

## ① WHAT THIS APP DOES (build the end-user screens of this product)
${inputs.description || "(none)"}

## ② ADDITIONAL NOTES
${inputs.notes || "(none)"}

## ③ VISUAL STYLE (aesthetics only — do NOT derive features from these)
- Industry:    ${inputs.industry}
- App Type:    ${inputs.appType}
- Style pack:  ${inputs.stylePack}
- Tone:        ${inputs.tone}
- Features selected: ${inputs.features.join(", ") || "none"}

## Design tokens — use EXACTLY these values
### Colors
${Object.entries(inputs.colors)
  .map(([k, v]) => `--color-${k.replace(/_/g, "-")}: ${v};`)
  .join("\n")}

### Typography
- Heading font: ${inputs.typography.heading_font}
- Body font:    ${inputs.typography.body_font}
- Scale:        ${JSON.stringify(inputs.typography.scale)}
- Weights:      ${JSON.stringify(inputs.typography.weights)}
- Line heights: ${JSON.stringify(inputs.typography.line_heights)}

### Icons (Material Symbols ${inputs.icons.weight}, fill=${inputs.icons.fill})
- Primary:    ${inputs.icons.primary_icons.join(", ")}
- Navigation: ${inputs.icons.navigation_icons.join(", ")}
- Actions:    ${inputs.icons.action_icons.join(", ")}

## Global theme
- Layout base: ${layoutBase} (${layoutBase === "desktop" ? "sidebar + topbar layout" : "centered phone shell, 390px"})
${JSON.stringify(inputs.globalTheme, null, 2)}

## Task
Generate the "${inputs.targetScreen}" screen of the "${inputs.appName}" end-user application.
This is a screen that users of the app interact with — NOT a meta-tool, NOT a project creator.

Rules:
- Output a single, complete, self-contained HTML file.
- No explanation. No markdown fences. No preamble. Start directly with <!DOCTYPE html>.
- All CSS inline in <style>. All JS inline in <script>.
- Map every design token above into :root CSS variables.
- Import fonts from Google Fonts CDN.
- Load Material Symbols ${inputs.icons.weight} from Google Fonts CDN.
- Use realistic, domain-specific content matching what real users of "${inputs.appName}" would see.
- ${layoutBase === "desktop"
    ? "Desktop layout: fixed 240px sidebar + sticky topbar + main content area."
    : "Mobile layout: 390px centered phone shell, status bar (top), bottom tab bar."}
`.trim();
}
