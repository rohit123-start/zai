import type { Project, Theme, ThemeTokens, GlobalTheme, ProjectBrain } from "./db";

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

// Tint primary color into a shadow rgba
function shadowColor(hex: string, alpha: number): string {
  if (!hex || hex.length < 7) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Industry → icons ─────────────────────────────────────────────────────────

const INDUSTRY_ICONS: Record<string, { set: string; primary: string[] }> = {
  beauty_wellness:     { set: "beauty_wellness",  primary: ["scissors","spa","self_care","favorite","star"] },
  food_delivery:       { set: "food_delivery",    primary: ["restaurant","delivery_dining","local_pizza","star","favorite"] },
  healthcare:          { set: "healthcare",        primary: ["medical_services","favorite","health_and_safety","monitor_heart","medication"] },
  finance_banking:     { set: "finance",           primary: ["account_balance","credit_card","payments","savings","trending_up"] },
  education:           { set: "education",         primary: ["school","book","quiz","leaderboard","emoji_events"] },
  travel_lifestyle:    { set: "travel",            primary: ["flight","hotel","map","explore","luggage"] },
  e_commerce_retail:   { set: "ecommerce",         primary: ["shopping_cart","store","favorite","local_offer","star"] },
  social_community:    { set: "social",            primary: ["group","chat","thumb_up","share","person_add"] },
  fitness_sport:       { set: "fitness",           primary: ["fitness_center","directions_run","timer","track_changes","sports"] },
  ai_technology:       { set: "tech",              primary: ["auto_awesome","psychology","hub","analytics","code"] },
  developer_tools:     { set: "developer",         primary: ["code","terminal","bug_report","api","data_object"] },
  entertainment_media: { set: "media",             primary: ["play_circle","movie","music_note","headphones","live_tv"] },
  events_ticketing:    { set: "events",            primary: ["event","confirmation_number","celebration","people","place"] },
  real_estate:         { set: "real_estate",       primary: ["home","apartment","location_on","key","sell"] },
  transport_logistics: { set: "transport",         primary: ["local_shipping","directions_car","route","speed","package_2"] },
  saas_productivity:   { set: "productivity",      primary: ["dashboard","task_alt","schedule","insights","workspace_premium"] },
  booking_appointments:{ set: "booking",           primary: ["calendar_today","schedule","person","check_circle","event_available"] },
  marketplace:         { set: "marketplace",       primary: ["storefront","sell","search","favorite","local_offer"] },
};

const DEFAULT_ICONS = { set: "general", primary: ["home","search","person","star","settings"] };

// ─── App type → screens ───────────────────────────────────────────────────────

const APP_SCREENS: Record<string, string[]> = {
  "Booking & Appointments": ["splash","onboarding","login","signup","home","search","provider_profile","booking_calendar","booking_confirm","payment","profile","settings","notifications","booking_history"],
  "Food & Delivery":        ["splash","onboarding","login","signup","home","restaurant_list","restaurant_detail","menu","cart","checkout","order_tracking","profile","order_history"],
  "E-commerce & Retail":    ["splash","onboarding","login","signup","home","category","product_list","product_detail","cart","checkout","payment","order_tracking","profile","wishlist"],
  "Marketplace":            ["splash","onboarding","login","signup","home","browse","listing_detail","seller_profile","cart","checkout","messages","profile","my_listings"],
  "Social & Community":     ["splash","onboarding","login","signup","feed","explore","create_post","post_detail","profile","notifications","messages","settings"],
  "Finance & Banking":      ["splash","onboarding","login","signup","dashboard","transactions","send_money","receive_money","cards","analytics","profile","settings"],
  "Healthcare":             ["splash","onboarding","login","signup","home","search_provider","provider_profile","appointment_booking","my_appointments","health_records","profile","settings"],
  "Fitness & Sport":        ["splash","onboarding","login","signup","home","workout_list","workout_detail","active_workout","progress","nutrition","profile","settings"],
  "Education":              ["splash","onboarding","login","signup","home","course_list","course_detail","lesson","quiz","progress","profile","settings"],
  "Travel & Lifestyle":     ["splash","onboarding","login","signup","home","search","destination","listing_list","listing_detail","booking_confirm","my_trips","profile","settings"],
  "SaaS & Productivity":    ["splash","onboarding","login","signup","dashboard","projects","project_detail","tasks","calendar","team","settings","billing"],
  "AI & Technology":        ["splash","onboarding","login","signup","home","new_chat","chat","history","settings","profile"],
  "Developer Tools":        ["splash","onboarding","login","signup","dashboard","projects","editor","terminal","logs","settings","billing"],
  "Entertainment & Media":  ["splash","onboarding","login","signup","home","browse","detail","player","search","watchlist","profile","settings"],
  "Events & Ticketing":     ["splash","onboarding","login","signup","home","event_list","event_detail","seat_map","checkout","ticket_wallet","profile","settings"],
  "Real Estate":            ["splash","onboarding","login","signup","home","map","property_list","property_detail","inquiry","saved","profile","settings"],
  "Transport & Logistics":  ["splash","onboarding","login","signup","home","book_ride","tracking","history","profile","settings"],
};

const DEFAULT_SCREENS = ["splash","onboarding","login","signup","home","search","detail","profile","settings"];

// ─── App type → nav flow ──────────────────────────────────────────────────────

const NAV_FLOWS: Record<string, Record<string, string[]>> = {
  "Booking & Appointments": { home:["search","provider_profile"], search:["provider_profile"], provider_profile:["booking_calendar"], booking_calendar:["booking_confirm"], booking_confirm:["payment"], payment:["booking_history"] },
  "Food & Delivery":        { home:["restaurant_list","restaurant_detail"], restaurant_detail:["menu"], menu:["cart"], cart:["checkout"], checkout:["payment"], payment:["order_tracking"] },
  "E-commerce & Retail":    { home:["category","product_list"], product_list:["product_detail"], product_detail:["cart"], cart:["checkout"], checkout:["payment"], payment:["order_tracking"] },
  "Social & Community":     { feed:["post_detail","profile"], explore:["post_detail","profile"], profile:["post_detail"] },
  "Finance & Banking":      { dashboard:["transactions","cards","analytics"], transactions:["send_money","receive_money"] },
  "Travel & Lifestyle":     { home:["search","destination"], destination:["listing_list"], listing_list:["listing_detail"], listing_detail:["booking_confirm"], booking_confirm:["my_trips"] },
  "SaaS & Productivity":    { dashboard:["projects","tasks","calendar"], projects:["project_detail"], project_detail:["tasks"] },
  "AI & Technology":        { home:["new_chat","history"], new_chat:["chat"], history:["chat"] },
};

// ─── App type → tab bar ───────────────────────────────────────────────────────

const TAB_BARS: Record<string, string[]> = {
  "Booking & Appointments": ["home","search","bookings","profile"],
  "Food & Delivery":        ["home","search","orders","profile"],
  "E-commerce & Retail":    ["home","search","cart","profile"],
  "Marketplace":            ["home","browse","messages","profile"],
  "Social & Community":     ["feed","explore","create","notifications","profile"],
  "Finance & Banking":      ["dashboard","payments","cards","profile"],
  "Healthcare":             ["home","search","appointments","profile"],
  "Fitness & Sport":        ["home","workouts","progress","profile"],
  "Education":              ["home","courses","progress","profile"],
  "Travel & Lifestyle":     ["home","search","trips","profile"],
  "SaaS & Productivity":    ["dashboard","projects","tasks","profile"],
  "AI & Technology":        ["home","history","settings","profile"],
  "Developer Tools":        ["dashboard","projects","logs","settings"],
  "Entertainment & Media":  ["home","browse","search","profile"],
  "Events & Ticketing":     ["home","explore","tickets","profile"],
  "Real Estate":            ["home","map","saved","profile"],
  "Transport & Logistics":  ["home","track","history","profile"],
};

const DEFAULT_TAB = ["home","search","profile","settings"];

// ─── Style pack → aesthetic/tone/motion ───────────────────────────────────────

type Aesthetic = { aesthetic: string; tone: string; motion: string };

const PACK_AESTHETICS: Record<string, Aesthetic> = {
  Sakura:          { aesthetic: "soft, feminine, pastel",         tone: "warm, approachable, premium",           motion: "gentle fades, soft springs, slow entrances" },
  Luxe:            { aesthetic: "dark, opulent, editorial",       tone: "exclusive, aspirational, sophisticated", motion: "slow dissolves, dramatic reveals, sharp cuts" },
  Fresh:           { aesthetic: "clean, botanical, airy",         tone: "healthy, optimistic, natural",           motion: "crisp slides, light bounces, quick fades" },
  Glow:            { aesthetic: "warm, organic, earthy",          tone: "nurturing, authentic, sensory",          motion: "smooth ease-in-out, warm fades, gentle blooms" },
  Petal:           { aesthetic: "soft, lavender, dreamy",         tone: "gentle, feminine, calm",                 motion: "floating entrances, soft fades, dreamy transitions" },
  Neural:          { aesthetic: "dark, technical, deep",          tone: "intelligent, powerful, precise",         motion: "fast cuts, data animations, sharp transitions" },
  Clarity:         { aesthetic: "clean, professional, light",     tone: "trustworthy, clear, efficient",          motion: "crisp slides, clean fades, minimal animation" },
  Terminal:        { aesthetic: "monospace, retro, matrix",       tone: "technical, hacker, raw",                 motion: "type-in animations, glitch effects, instant cuts" },
  Gradient:        { aesthetic: "vibrant, gradient, neon",        tone: "exciting, modern, bold",                 motion: "gradient shifts, energetic bounces, neon pulses" },
  Pulse:           { aesthetic: "cyan, electric, futuristic",     tone: "cutting-edge, fast, dynamic",            motion: "electric reveals, fast pulses, sharp entrances" },
  Slate:           { aesthetic: "professional, clean, structured",tone: "reliable, authoritative, trustworthy",   motion: "smooth slides, professional fades, clean transitions" },
  Obsidian:        { aesthetic: "dark, premium, gold",            tone: "exclusive, powerful, elite",             motion: "smooth reveals, gold shimmer, elegant transitions" },
  Nordic:          { aesthetic: "minimal, Scandinavian, calm",    tone: "focused, honest, trustworthy",           motion: "subtle slides, minimal animation, clean fades" },
  Vault:           { aesthetic: "dark, monochrome, secure",       tone: "secure, institutional, serious",         motion: "technical reveals, minimal animation, precise timing" },
  Mint:            { aesthetic: "green, fresh, growth",           tone: "growing, healthy, positive",             motion: "growth animations, upward reveals, fresh bounces" },
  Campus:          { aesthetic: "bright, academic, blue",         tone: "encouraging, clear, approachable",       motion: "friendly bounces, bright reveals, smooth slides" },
  Scholar:         { aesthetic: "teal, intellectual, warm",       tone: "thoughtful, precise, engaged",           motion: "measured transitions, scholarly reveals, smooth" },
  Kids:            { aesthetic: "playful, colourful, joyful",     tone: "fun, encouraging, safe",                 motion: "bouncy entrances, playful pops, cartoon springs" },
  Academy:         { aesthetic: "dark, gold, prestigious",        tone: "elite, rigorous, aspirational",          motion: "dramatic reveals, gold shimmer, slow entrances" },
  Stream:          { aesthetic: "dark, cinematic, red",           tone: "entertainment, engaging, bold",          motion: "cinematic reveals, dramatic fades, full-screen transitions" },
  Podcast:         { aesthetic: "dark, purple, intimate",         tone: "authentic, immersive, personal",         motion: "smooth fades, intimate reveals, gentle transitions" },
  Gaming:          { aesthetic: "dark, neon, electric",           tone: "exciting, competitive, immersive",       motion: "explosive reveals, fast cuts, particle effects" },
  Magazine:        { aesthetic: "editorial, clean, classic",      tone: "informative, sophisticated, curated",    motion: "editorial flips, clean slides, measured transitions" },
  Spotlight:       { aesthetic: "dark, gold, theatrical",         tone: "dramatic, prestige, exclusive",          motion: "spotlight reveals, gold shimmer, theatrical entrances" },
  Power:           { aesthetic: "dark, bold, yellow",             tone: "energetic, strong, motivating",          motion: "explosive entrances, fast transitions, power animations" },
  Athletic:        { aesthetic: "clean, blue, precise",           tone: "performance, professional, sharp",       motion: "fast slides, sharp cuts, performance reveals" },
  Zen:             { aesthetic: "soft green, calm, balanced",     tone: "peaceful, mindful, restorative",         motion: "breathing animations, slow fades, gentle slides" },
  Gains:           { aesthetic: "dark, red, intense",             tone: "hardcore, raw, intense",                 motion: "hard cuts, intense reveals, fast transitions" },
  Track:           { aesthetic: "dark, cyan, technical",          tone: "data-driven, precise, performance",      motion: "data animations, precision reveals, sharp transitions" },
  Linear:          { aesthetic: "dark, indigo, precise",          tone: "focused, productive, elegant",           motion: "instant transitions, precise animations, minimal" },
  Notion:          { aesthetic: "clean, minimal, warm",           tone: "calm, flexible, focused",                motion: "subtle fades, minimal animation, clean reveals" },
  Dashboard:       { aesthetic: "dark, indigo, data",             tone: "powerful, insightful, professional",     motion: "data reveals, smooth slides, professional transitions" },
  Focus:           { aesthetic: "white, minimal, pure",           tone: "distraction-free, calm, precise",        motion: "instant, minimal, no decoration" },
  Command:         { aesthetic: "black, green, terminal",         tone: "powerful, developer, raw",               motion: "type-in animations, instant cuts, terminal style" },
  Wanderlust:      { aesthetic: "dark, orange, adventurous",      tone: "adventurous, free, exciting",            motion: "dramatic slides, wandering reveals, bold entrances" },
  Resort:          { aesthetic: "warm, sand, luxurious",          tone: "relaxed, premium, escapist",             motion: "slow fades, gentle waves, luxurious transitions" },
  Adventure:       { aesthetic: "earthy, warm, rugged",           tone: "authentic, bold, outdoorsy",             motion: "rugged reveals, earthy transitions, bold entrances" },
  "City Guide":    { aesthetic: "clean, editorial, urban",        tone: "informed, modern, local",                motion: "editorial slides, clean reveals, smooth transitions" },
  Nomad:           { aesthetic: "warm, minimal, earthy",          tone: "free, adaptable, authentic",             motion: "wandering reveals, warm fades, minimal animation" },
  Appetite:        { aesthetic: "warm, red, appetising",          tone: "hungry, vibrant, joyful",                motion: "mouth-watering reveals, warm bounces, energetic" },
  "Street Food":   { aesthetic: "dark, yellow, urban",            tone: "bold, fun, street-level",                motion: "bold reveals, fast cuts, urban energy" },
  "Fresh Market":  { aesthetic: "green, fresh, organic",          tone: "healthy, honest, local",                 motion: "fresh bounces, organic reveals, clean slides" },
  Bistro:          { aesthetic: "warm, brown, classic",           tone: "welcoming, classic, artisan",            motion: "warm fades, classic reveals, gentle transitions" },
  "Dark Kitchen":  { aesthetic: "dark, amber, professional",      tone: "efficient, modern, bold",                motion: "sharp reveals, bold transitions, fast cuts" },
  Clinical:        { aesthetic: "clean, blue, precise",           tone: "trustworthy, clinical, safe",            motion: "clean slides, precise reveals, minimal animation" },
  "Soft Care":     { aesthetic: "cyan, warm, caring",             tone: "caring, approachable, reassuring",       motion: "gentle fades, warm reveals, soft transitions" },
  "Modern Medical":{ aesthetic: "dark, teal, advanced",           tone: "cutting-edge, trusted, sophisticated",   motion: "technical reveals, precise transitions, sharp" },
  Wellness:        { aesthetic: "soft green, natural, calm",      tone: "holistic, nurturing, balanced",          motion: "breathing animations, slow fades, natural transitions" },
  Emergency:       { aesthetic: "clean, red, urgent",             tone: "urgent, clear, reliable",                motion: "instant reveals, urgent transitions, clear animation" },
};

const DEFAULT_AESTHETIC: Aesthetic = {
  aesthetic: "clean, minimal, modern",
  tone: "professional, clear, approachable",
  motion: "smooth slides, clean fades, standard transitions",
};

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

  // ── Icons ────────────────────────────────────────────────────────────────────
  const iconData = INDUSTRY_ICONS[industryKey] ?? INDUSTRY_ICONS[toKey(appType)] ?? DEFAULT_ICONS;

  // ── Screens ──────────────────────────────────────────────────────────────────
  const inventory = APP_SCREENS[appType] ?? APP_SCREENS[industry] ?? DEFAULT_SCREENS;
  const navFlow = NAV_FLOWS[appType] ?? NAV_FLOWS[industry] ?? {};
  const tabBar = TAB_BARS[appType] ?? TAB_BARS[industry] ?? DEFAULT_TAB;

  // ── Aesthetic ────────────────────────────────────────────────────────────────
  const aesthetic = PACK_AESTHETICS[packName] ?? DEFAULT_AESTHETIC;

  // ── Animations ───────────────────────────────────────────────────────────────
  const isGentle  = aesthetic.motion.includes("gentle") || aesthetic.motion.includes("soft") || aesthetic.motion.includes("slow");
  const isFast    = aesthetic.motion.includes("fast") || aesthetic.motion.includes("instant") || aesthetic.motion.includes("explosive");
  const isDramatic = aesthetic.motion.includes("dramatic") || aesthetic.motion.includes("cinematic");

  // ── Shadows (tinted with primary) ────────────────────────────────────────────
  const shadowBase = darkMode ? "0,0,0" : `${parseInt(t.primary.slice(1,3),16)},${parseInt(t.primary.slice(3,5),16)},${parseInt(t.primary.slice(5,7),16)}`;
  const shadows = {
    sm: `0 1px 4px rgba(${shadowBase},0.08)`,
    md: `0 4px 16px rgba(${shadowBase},0.12)`,
    lg: `0 8px 32px rgba(${shadowBase},0.16)`,
  };

  // ── Global token fallbacks ────────────────────────────────────────────────────
  const spacing = globalTokens?.spacing ?? { xs:"4px", sm:"8px", md:"16px", lg:"24px", xl:"32px", xxl:"48px" };
  const radius  = globalTokens?.radius  ?? { sm:"8px", md:"12px", lg:"16px", xl:"20px", pill:"999px" };
  const fontSizes = globalTokens?.font_sizes ?? { h1:"28px", h2:"22px", h3:"18px", h4:"16px", body:"15px", caption:"12px", label:"11px" };
  const lineHeights = globalTokens?.line_heights ?? { heading:"1.2", body:"1.5", caption:"1.4" };
  const breakpoints = globalTokens?.breakpoints ?? { iphone:"390px", iphone_max:"430px", ipad_mini:"744px", ipad:"820px", ipad_pro:"1024px" };

  // ── Component styles ──────────────────────────────────────────────────────────
  const isRounded = iconWeight === "rounded";
  const pillOrRound = isRounded ? "pill shape" : "rounded md";

  // ── System summary ────────────────────────────────────────────────────────────
  const platformStr = platform.join(" and ");
  const systemSummary = `${industry} ${appType} called ${project.name}. ${packName} aesthetic — ${t.primary} primary, ${t.heading_font} headings, ${t.body_font} body, Material Symbols ${iconWeight} icons. ${aesthetic.tone}. Platform: ${platformStr}. Core action: ${project.primary_action ?? "main action"}. Target: ${project.target_user ?? "general users"}.`;

  // ── Base device ───────────────────────────────────────────────────────────────
  const baseDevice = platform.includes("Android") && !platform.includes("iOS") ? "Android" : "iPhone";

  return {
    project: {
      id: project.id,
      name: project.name,
      type: toKey(appType),
      industry: industryKey,
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
          h1: fontSizes.h1 ?? "28px",
          h2: fontSizes.h2 ?? "22px",
          h3: fontSizes.h3 ?? "18px",
          body: fontSizes.body ?? "15px",
          caption: fontSizes.caption ?? "12px",
          label: fontSizes.label ?? "11px",
        },
        weights: { heading: "700", body: "400", emphasis: "600" },
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
      shadows,
    },

    icons: {
      library:         "material-symbols",
      weight:          iconWeight,
      fill:            1,
      industry_set:    iconData.set,
      primary_icons:   iconData.primary,
      navigation_icons:["home","search","calendar_today","person"],
      action_icons:    ["add","edit","share","more_horiz","arrow_forward"],
      fallback:        `material-symbols-${iconWeight}`,
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
      base_device:      baseDevice,
      breakpoints: {
        iphone:    breakpoints.iphone     ?? "390px",
        iphone_max:breakpoints.iphone_max ?? "430px",
        ipad_mini: breakpoints.ipad_mini  ?? "744px",
        ipad:      breakpoints.ipad       ?? "820px",
        ipad_pro:  breakpoints.ipad_pro   ?? "1024px",
      },
      nav_shift_at:     "1024px",
      layout_shift_at:  "744px",
      touch_target_min: "44px",
      grid_base:        "8px",
      safe_areas: {
        ios_top:          "59px",
        ios_bottom:       "34px",
        android_status:   "24dp",
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
      brain_version:          "2.0",
      created_at:             today,
      updated_at:             today,
      total_prompts:          0,
      total_screens_generated: inventory.length,
    },

    _inputs: {
      screenshots:        inputs.screenshots,
      inspiration_images: inputs.inspiration_images,
      reference_urls:     inputs.reference_urls,
      font_pairing:       inputs.font_pairing,
    },
  };
}
