import type { Project, Theme, ThemeTokens, GlobalTheme, ProjectBrain } from "./db";
import type { LLMScreenPlan } from "@/app/api/generate-screens-plan/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function isDark(hex: string): boolean {
  if (!hex || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.4;
}

// ─── Main generator ───────────────────────────────────────────────────────────

export function generateBrain(
  project: Project,
  stylePack: Theme,
  globalTokens: GlobalTheme | null,
  inputs: {
    screenshots: string[];
    inspiration_images: string[];
    reference_urls: string[];
    font_pairing: string;
  },
  llmPlan: LLMScreenPlan,
  orgData?: {
    org_id?: string;
    plan?: string;
    credits_remaining?: number;
    credits_total?: number;
    credits_reset?: string;
  }
): ProjectBrain {
  const t: ThemeTokens = stylePack.tokens;
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const packName = stylePack.name;
  const industry = project.industry ?? "Other";
  const industryKey = toKey(industry);
  const appType = project.app_type ?? "Other";
  const platform = (project.platform ?? ["iOS"]).map((p) => p.charAt(0).toUpperCase() + p.slice(1));
  const darkMode = isDark(t.background);
  const iconWeight = t.icon_weight ?? "rounded";

  // ── Screen plan from LLM 1 ────────────────────────────────────────────────
  const inventory  = llmPlan.screens   ?? [];
  const navFlow    = llmPlan.nav_flow  ?? {};
  const tabBar     = llmPlan.tab_bar   ?? ["home", "search", "profile"];
  const aesthetic  = llmPlan.aesthetic ?? {
    aesthetic: "clean, minimal, modern",
    tone:      "professional, clear, approachable",
    motion:    "smooth slides, clean fades, standard transitions",
  };
  const iconData = llmPlan.icons ?? { set: "general", primary_icons: ["home", "search", "person", "star", "settings"] };

  // ── Animations ───────────────────────────────────────────────────────────
  const isGentle   = aesthetic.motion.includes("gentle") || aesthetic.motion.includes("soft") || aesthetic.motion.includes("slow");
  const isFast     = aesthetic.motion.includes("fast") || aesthetic.motion.includes("instant") || aesthetic.motion.includes("explosive");
  const isDramatic = aesthetic.motion.includes("dramatic") || aesthetic.motion.includes("cinematic");

  // ── Global token fallbacks ────────────────────────────────────────────────
  function scalarVal(v: unknown, vp: "mobile" | "tablet" | "desktop" = "mobile"): string {
    if (typeof v === "string") return v;
    if (typeof v === "object" && v !== null) {
      const o = v as Record<string, string>;
      return o[vp] ?? o.mobile ?? String(Object.values(o)[0] ?? "");
    }
    return String(v ?? "");
  }

  const rawSpacing = (globalTokens?.spacing ?? {}) as Record<string, unknown>;
  const spacing = {
    xs:     scalarVal(rawSpacing.xs)     || "4px",
    sm:     scalarVal(rawSpacing.sm)     || "8px",
    md:     scalarVal(rawSpacing.md)     || "16px",
    lg:     scalarVal(rawSpacing.lg)     || "24px",
    xl:     scalarVal(rawSpacing.xl)     || "32px",
    xxl:    scalarVal(rawSpacing.xxl)    || "48px",
    screen: scalarVal(rawSpacing.screen) || "24px",
    card:   scalarVal(rawSpacing.card)   || "16px",
  };

  const radius = (globalTokens?.radius ?? { sm: "8px", md: "12px", lg: "16px", xl: "20px", pill: "999px" }) as Record<string, string>;

  const rawFontSizes = (globalTokens?.font_sizes ?? {}) as Record<string, unknown>;
  const fontSizes = {
    h1:      scalarVal(rawFontSizes.h1)      || "28px",
    h2:      scalarVal(rawFontSizes.h2)      || "22px",
    h3:      scalarVal(rawFontSizes.h3)      || "18px",
    h4:      scalarVal(rawFontSizes.h4)      || "16px",
    body:    scalarVal(rawFontSizes.body)    || "15px",
    caption: scalarVal(rawFontSizes.caption) || "12px",
    label:   scalarVal(rawFontSizes.label)   || "11px",
  };

  const rawLineHeights = (globalTokens?.line_heights ?? {}) as Record<string, unknown>;
  const lineHeights = {
    heading: scalarVal(rawLineHeights.heading) || "1.2",
    body:    scalarVal(rawLineHeights.body)    || "1.5",
    caption: scalarVal(rawLineHeights.caption) || "1.4",
  };

  const rawBp = (globalTokens?.breakpoints ?? {}) as Record<string, string>;
  const breakpoints = {
    iphone:     rawBp.mobile_max ?? rawBp.iphone     ?? "390px",
    iphone_max: rawBp.mobile_max ?? rawBp.iphone_max ?? "430px",
    ipad_mini:  rawBp.tablet     ?? rawBp.ipad_mini  ?? "744px",
    ipad:       rawBp.tablet     ?? rawBp.ipad       ?? "820px",
    ipad_pro:   rawBp.desktop    ?? rawBp.ipad_pro   ?? "1280px",
  };

  // ── Component styles ──────────────────────────────────────────────────────
  const isRounded = iconWeight === "rounded";
  const pillOrRound = isRounded ? "pill shape" : "rounded md";

  // ── System summary ────────────────────────────────────────────────────────
  const platformStr = platform.join(" and ");
  const complexity = project.complexity ?? "MVP";
  const features = project.features ?? [];
  const description = project.description ?? "";
  const systemSummary = `${industry} ${appType} app called "${project.name}". ${complexity} complexity. ${packName} aesthetic — ${t.primary} primary colour, ${t.heading_font} headings, ${t.body_font} body, Material Symbols ${iconWeight} icons. Tone: ${aesthetic.tone}. Platform: ${platformStr}. Description: ${description || "(none)"}. Features: ${features.length ? features.join(", ") : "none specified"}.`;

  // ── Base device ───────────────────────────────────────────────────────────
  const baseDevice = platform.includes("Android") && !platform.includes("iOS") ? "Android" : "iPhone";

  return {
    project: {
      id: project.id,
      name: project.name,
      type: toKey(appType),
      industry: industryKey,
      app_type: appType,
      description,
      complexity,
      features,
      primary_action: project.primary_action ?? "",
      target_user: project.target_user ?? "",
      platform,
      core_features: project.core_features ?? "",
      notes: project.setup_notes ?? undefined,
      created_at: project.created_at.slice(0, 10),
      updated_at: today,
    },

    design_tokens: {
      colors: {
        primary:        t.primary,
        primary_light:  t.primary_light,
        primary_dark:   t.primary_dark,
        secondary:      t.secondary,
        accent:         t.accent,
        background:     t.background,
        surface:        t.surface,
        surface2:       t.surface2,
        border:         t.border,
        text:           t.text,
        text_muted:     t.text_muted,
        text_inverse:   t.text_inverse,
        success:        t.success,
        error:          t.error,
        warning:        t.warning,
        ...(t.gradient_start ? { gradient_start: t.gradient_start, gradient_end: t.gradient_end! } : {}),
      },
      typography: {
        heading_font: t.heading_font,
        body_font:    t.body_font,
        scale: {
          h1:      fontSizes.h1      ?? "28px",
          h2:      fontSizes.h2      ?? "22px",
          h3:      fontSizes.h3      ?? "18px",
          body:    fontSizes.body    ?? "15px",
          caption: fontSizes.caption ?? "12px",
          label:   fontSizes.label   ?? "11px",
        },
        weights:      { heading: "700", body: "400", emphasis: "600" },
        line_heights: {
          heading: lineHeights.heading ?? "1.2",
          body:    lineHeights.body    ?? "1.5",
          caption: lineHeights.caption ?? "1.4",
        },
      },
      spacing: {
        base: spacing.sm ?? "8px",
        scale: {
          xs:  spacing.xs  ?? "4px",
          sm:  spacing.sm  ?? "8px",
          md:  spacing.md  ?? "16px",
          lg:  spacing.lg  ?? "24px",
          xl:  spacing.xl  ?? "32px",
          xxl: spacing.xxl ?? "48px",
        },
        screen_padding: spacing.screen ?? "24px",
        card_padding:   spacing.card   ?? "16px",
      },
      radius: {
        sm:      radius.sm   ?? "8px",
        md:      radius.md   ?? "12px",
        lg:      radius.lg   ?? "16px",
        xl:      radius.xl   ?? "20px",
        pill:    radius.pill ?? "999px",
        default: radius.lg   ?? "16px",
      },
      shadows: {
        sm: darkMode ? "0 1px 4px rgba(0,0,0,0.08)" : `0 1px 4px rgba(${parseInt(t.primary.slice(1,3),16)},${parseInt(t.primary.slice(3,5),16)},${parseInt(t.primary.slice(5,7),16)},0.08)`,
        md: darkMode ? "0 4px 16px rgba(0,0,0,0.12)" : `0 4px 16px rgba(${parseInt(t.primary.slice(1,3),16)},${parseInt(t.primary.slice(3,5),16)},${parseInt(t.primary.slice(5,7),16)},0.12)`,
        lg: darkMode ? "0 8px 32px rgba(0,0,0,0.16)" : `0 8px 32px rgba(${parseInt(t.primary.slice(1,3),16)},${parseInt(t.primary.slice(3,5),16)},${parseInt(t.primary.slice(5,7),16)},0.16)`,
      },
    },

    icons: {
      library:          "material-symbols",
      weight:           iconWeight,
      fill:             1,
      industry_set:     iconData.set,
      primary_icons:    iconData.primary_icons,
      navigation_icons: tabBar.slice(0, 4),
      action_icons:     ["add", "edit", "share", "more_horiz", "arrow_forward"],
      fallback:         `material-symbols-${iconWeight}`,
    },

    style_pack: {
      name:      packName,
      aesthetic: aesthetic.aesthetic,
      tone:      aesthetic.tone,
      motion:    aesthetic.motion,
    },

    components: {
      button: {
        primary:     `${pillOrRound}, filled, primary color, shadow md`,
        secondary:   `${pillOrRound}, outlined, primary border`,
        height:      "52px",
        font_weight: "600",
      },
      card: {
        style:       `${darkMode ? "dark surface" : "white surface"}, shadow sm, radius lg`,
        image_ratio: "16:9",
        padding:     "16px",
      },
      input: {
        style:  `rounded md, ${darkMode ? "dark border" : "soft border"}, focus ring primary`,
        height: "52px",
      },
      nav: {
        type:  platform.includes("Web") && !platform.includes("iOS") && !platform.includes("Android") ? "sidebar" : "bottom_tab",
        items: tabBar.length,
        style: `${darkMode ? "dark surface" : "white surface"}, top border, blur backdrop`,
      },
      header: { style: "large title, sticky on scroll", height: "56px" },
      badge:  { style: "pill, small, primary light background" },
      modal: {
        mobile: "bottom sheet, rounded top",
        tablet: "centered modal, rounded all",
      },
    },

    scaling: {
      base_device: baseDevice,
      breakpoints: {
        iphone:     breakpoints.iphone     ?? "390px",
        iphone_max: breakpoints.iphone_max ?? "430px",
        ipad_mini:  breakpoints.ipad_mini  ?? "744px",
        ipad:       breakpoints.ipad       ?? "820px",
        ipad_pro:   breakpoints.ipad_pro   ?? "1024px",
      },
      nav_shift_at:     "1024px",
      layout_shift_at:  "744px",
      touch_target_min: "44px",
      grid_base:        "8px",
      safe_areas: {
        ios_top:        "59px",
        ios_bottom:     "34px",
        android_status: "24dp",
      },
    },

    screens: {
      inventory,
      navigation_flow: navFlow,
      tab_bar:         tabBar,
    },

    animations: {
      default_duration:  isFast ? "200ms" : isDramatic ? "500ms" : "300ms",
      easing:            isGentle
        ? "cubic-bezier(0.34, 1.56, 0.64, 1)"
        : isFast
        ? "cubic-bezier(0.4, 0, 1, 1)"
        : "cubic-bezier(0.4, 0, 0.2, 1)",
      screen_transition: "slide horizontal",
      entrance:          isGentle ? "fade up 8px" : isFast ? "fade in" : "fade up 16px",
      exit:              "fade out",
      press_state:       "scale 0.97",
      loading:           "skeleton pulse",
      stagger_delay:     isFast ? "40ms" : "60ms",
    },

    capsules: {
      animate:   true,
      dark_mode: darkMode,
      glass:     false,
      wireframe: false,
    },

    custom_additions: [],

    prompt_context: {
      system_summary: systemSummary,
      last_prompt:    null,
      session_count:  0,
    },

    versions: {
      current: 1,
      history: [
        {
          version:          1,
          timestamp:        now,
          prompt:           "Project created",
          screens_affected: ["all"],
        },
      ],
    },

    org: {
      org_id:            orgData?.org_id            ?? null,
      plan:              orgData?.plan               ?? "free",
      credits_remaining: orgData?.credits_remaining  ?? 0,
      credits_total:     orgData?.credits_total       ?? 0,
      credits_reset:     orgData?.credits_reset       ?? "",
    },

    meta: {
      brain_version:           "2.0",
      created_at:              today,
      updated_at:              today,
      total_prompts:           0,
      total_screens_generated: inventory.length,
    },

    global_theme: globalTokens ?? null,

    _inputs: {
      project_name:       project.name,
      description,
      industry,
      app_type:           appType,
      project_type:       project.project_type ?? "new_idea",
      complexity,
      features,
      style_pack:         packName,
      font_pairing:       inputs.font_pairing,
      screenshots:        inputs.screenshots,
      inspiration_images: inputs.inspiration_images,
      reference_urls:     inputs.reference_urls,
    },
  };
}
