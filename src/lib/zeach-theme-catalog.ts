/**
 * Zeach theme catalog — 81 themes with full token data from zeach-theme-tokens.json.
 * Industry → theme name mapping from zeach-industry-brains/*.json.
 * Font recommendations from brain files' `fonts.ai_pick_*` fields.
 *
 * Guard-rail: this file is the single source of truth for theme display.
 * When a theme is SELECTED by the user, its JSON is fetched from the DB themes table.
 */

export type ZeachTheme = {
  desc: string;
  background: string;
  primary: string;
  primary_light: string;
  primary_dark: string;
  secondary: string;
  accent: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  text_muted: string;
  text_inverse: string;
  heading_font: string;
  body_font: string;
  icon_weight: "rounded" | "sharp" | "outlined";
  animation_speed: "slow" | "medium" | "fast";
  animation_style: "gentle" | "smooth" | "snappy";
  easing: "spring" | "ease-out" | "linear";
};

// ─── Full catalog — 81 themes ─────────────────────────────────────────────────

export const ZEACH_THEMES: Record<string, ZeachTheme> = {
  // ── Beauty & Wellness ───────────────────────────────────────────────────────
  Sakura: { desc:"Soft, feminine, pastel", background:"#fff5f7", primary:"#ec4899", primary_light:"#fce7f3", primary_dark:"#be185d", secondary:"#f9a8d4", accent:"#db2777", surface:"#ffffff", surface2:"#fdf2f8", border:"#fce7f3", text:"#1e1b1e", text_muted:"#9d8fa0", text_inverse:"#ffffff", heading_font:"Playfair Display", body_font:"DM Sans", icon_weight:"rounded", animation_speed:"slow", animation_style:"gentle", easing:"spring" },
  Luxe: { desc:"Gold accents, premium dark", background:"#1a0a2e", primary:"#b8860b", primary_light:"#fef9ee", primary_dark:"#92680a", secondary:"#d4af37", accent:"#f5d060", surface:"#2d1b4e", surface2:"#3d2460", border:"#4a2d6e", text:"#f5f0e8", text_muted:"#a89db8", text_inverse:"#1a0a2e", heading_font:"Cormorant", body_font:"Nunito", icon_weight:"sharp", animation_speed:"slow", animation_style:"smooth", easing:"ease-out" },
  Fresh: { desc:"Clean botanical green", background:"#f8fffe", primary:"#16a34a", primary_light:"#f0fdf4", primary_dark:"#15803d", secondary:"#86efac", accent:"#22c55e", surface:"#ffffff", surface2:"#f0fdf4", border:"#dcfce7", text:"#14231e", text_muted:"#6b8f7a", text_inverse:"#ffffff", heading_font:"Inter", body_font:"Inter", icon_weight:"rounded", animation_speed:"medium", animation_style:"gentle", easing:"spring" },
  Glow: { desc:"Warm ivory, rose gold", background:"#fdf8f4", primary:"#c0956f", primary_light:"#fdf6f0", primary_dark:"#a07050", secondary:"#e8c9a8", accent:"#d4a574", surface:"#ffffff", surface2:"#fdf0e8", border:"#f5e0cc", text:"#2c1810", text_muted:"#9c7c6a", text_inverse:"#ffffff", heading_font:"Lora", body_font:"DM Sans", icon_weight:"rounded", animation_speed:"slow", animation_style:"gentle", easing:"spring" },
  Petal: { desc:"Lavender, lilac gradients", background:"#faf5ff", primary:"#a78bfa", primary_light:"#f5f3ff", primary_dark:"#7c3aed", secondary:"#ddd6fe", accent:"#8b5cf6", surface:"#ffffff", surface2:"#f5f3ff", border:"#ede9fe", text:"#1e1b2e", text_muted:"#8b80a0", text_inverse:"#ffffff", heading_font:"Nunito", body_font:"Nunito", icon_weight:"rounded", animation_speed:"slow", animation_style:"gentle", easing:"spring" },

  // ── Food & Beverage ─────────────────────────────────────────────────────────
  Appetite: { desc:"Warm red, bold, high energy", background:"#fffbf5", primary:"#dc2626", primary_light:"#fef2f2", primary_dark:"#b91c1c", secondary:"#fca5a5", accent:"#f97316", surface:"#ffffff", surface2:"#fff7ed", border:"#fed7aa", text:"#1c0a00", text_muted:"#9a6a50", text_inverse:"#ffffff", heading_font:"Syne", body_font:"DM Sans", icon_weight:"rounded", animation_speed:"fast", animation_style:"snappy", easing:"spring" },
  "Street Food": { desc:"Urban black, neon energy", background:"#0f0f0f", primary:"#facc15", primary_light:"#fefce8", primary_dark:"#ca8a04", secondary:"#fde68a", accent:"#f97316", surface:"#1a1a1a", surface2:"#242424", border:"#333333", text:"#f5f5f5", text_muted:"#a0a0a0", text_inverse:"#0f0f0f", heading_font:"Space Grotesk", body_font:"Space Grotesk", icon_weight:"sharp", animation_speed:"fast", animation_style:"snappy", easing:"spring" },
  "Fresh Market": { desc:"Organic green, fresh", background:"#f9fdf5", primary:"#65a30d", primary_light:"#f7fee7", primary_dark:"#4d7c0f", secondary:"#bef264", accent:"#84cc16", surface:"#ffffff", surface2:"#f1f8e9", border:"#d9f0b0", text:"#1a2e05", text_muted:"#6b8a3e", text_inverse:"#ffffff", heading_font:"DM Sans", body_font:"DM Sans", icon_weight:"rounded", animation_speed:"medium", animation_style:"gentle", easing:"spring" },
  Bistro: { desc:"Warm cream, restaurant quality", background:"#fdfaf6", primary:"#92400e", primary_light:"#fffbeb", primary_dark:"#78350f", secondary:"#d97706", accent:"#b45309", surface:"#ffffff", surface2:"#fef9f0", border:"#fde8c8", text:"#1c1008", text_muted:"#8c6a48", text_inverse:"#ffffff", heading_font:"Lora", body_font:"DM Sans", icon_weight:"rounded", animation_speed:"medium", animation_style:"smooth", easing:"ease-out" },
  "Dark Kitchen": { desc:"Near black, amber accents", background:"#0a0a0a", primary:"#f59e0b", primary_light:"#fffbeb", primary_dark:"#d97706", secondary:"#fcd34d", accent:"#fb923c", surface:"#141414", surface2:"#1e1e1e", border:"#2a2a2a", text:"#f0f0f0", text_muted:"#808080", text_inverse:"#0a0a0a", heading_font:"Geist", body_font:"Geist", icon_weight:"sharp", animation_speed:"fast", animation_style:"snappy", easing:"ease-out" },

  // ── Healthcare ──────────────────────────────────────────────────────────────
  Clinical: { desc:"Pure white, sterile precision", background:"#f8faff", primary:"#2563eb", primary_light:"#eff6ff", primary_dark:"#1d4ed8", secondary:"#93c5fd", accent:"#3b82f6", surface:"#ffffff", surface2:"#f0f5ff", border:"#e0eaff", text:"#0f172a", text_muted:"#64748b", text_inverse:"#ffffff", heading_font:"Inter", body_font:"Inter", icon_weight:"outlined", animation_speed:"medium", animation_style:"smooth", easing:"ease-out" },
  "Soft Care": { desc:"Calming blue, warm whites", background:"#f8fdff", primary:"#0891b2", primary_light:"#ecfeff", primary_dark:"#0e7490", secondary:"#a5f3fc", accent:"#06b6d4", surface:"#ffffff", surface2:"#f0faff", border:"#cceeff", text:"#0c2340", text_muted:"#6b8fa8", text_inverse:"#ffffff", heading_font:"Nunito", body_font:"Nunito", icon_weight:"rounded", animation_speed:"slow", animation_style:"gentle", easing:"spring" },
  "Modern Medical": { desc:"Dark tech, teal accents", background:"#0f1923", primary:"#14b8a6", primary_light:"#f0fdfa", primary_dark:"#0f766e", secondary:"#5eead4", accent:"#2dd4bf", surface:"#162130", surface2:"#1e2e40", border:"#243848", text:"#e2f0f8", text_muted:"#7a9ab5", text_inverse:"#0f1923", heading_font:"Geist", body_font:"Geist", icon_weight:"outlined", animation_speed:"fast", animation_style:"smooth", easing:"linear" },
  Wellness: { desc:"Sage green, holistic", background:"#f8fcf9", primary:"#4d7c5f", primary_light:"#f0faf3", primary_dark:"#3a5e47", secondary:"#a7c4b0", accent:"#6aab82", surface:"#ffffff", surface2:"#eef6f1", border:"#d4ead9", text:"#1a2e22", text_muted:"#6b8a76", text_inverse:"#ffffff", heading_font:"DM Sans", body_font:"DM Sans", icon_weight:"rounded", animation_speed:"slow", animation_style:"gentle", easing:"spring" },
  Emergency: { desc:"High contrast, zero confusion", background:"#ffffff", primary:"#dc2626", primary_light:"#fef2f2", primary_dark:"#b91c1c", secondary:"#fca5a5", accent:"#ef4444", surface:"#ffffff", surface2:"#f9f9f9", border:"#e5e5e5", text:"#0a0a0a", text_muted:"#555555", text_inverse:"#ffffff", heading_font:"Inter", body_font:"Inter", icon_weight:"sharp", animation_speed:"fast", animation_style:"snappy", easing:"linear" },

  // ── Finance ─────────────────────────────────────────────────────────────────
  Obsidian: { desc:"Premium black, gold details", background:"#0a0a0f", primary:"#b8860b", primary_light:"#fef9ee", primary_dark:"#92680a", secondary:"#d4af37", accent:"#f5d060", surface:"#12121a", surface2:"#1a1a26", border:"#242433", text:"#f0eefc", text_muted:"#8080aa", text_inverse:"#0a0a0f", heading_font:"Geist", body_font:"Geist", icon_weight:"sharp", animation_speed:"medium", animation_style:"smooth", easing:"ease-out" },
  Slate: { desc:"Corporate grey, clean", background:"#f8f9fc", primary:"#2563eb", primary_light:"#eff6ff", primary_dark:"#1d4ed8", secondary:"#93c5fd", accent:"#3b82f6", surface:"#ffffff", surface2:"#f1f4f9", border:"#e2e8f0", text:"#0f172a", text_muted:"#64748b", text_inverse:"#ffffff", heading_font:"Inter", body_font:"Inter", icon_weight:"sharp", animation_speed:"medium", animation_style:"smooth", easing:"ease-out" },
  Nordic: { desc:"Cold blue, Scandinavian minimal", background:"#f5f8fc", primary:"#0369a1", primary_light:"#f0f9ff", primary_dark:"#075985", secondary:"#7dd3fc", accent:"#0ea5e9", surface:"#ffffff", surface2:"#edf3f8", border:"#d1e3f0", text:"#0c1e2e", text_muted:"#5a7a92", text_inverse:"#ffffff", heading_font:"Inter", body_font:"Inter", icon_weight:"outlined", animation_speed:"medium", animation_style:"smooth", easing:"ease-out" },
  Vault: { desc:"Deep navy, silver, secure", background:"#0d1117", primary:"#94a3b8", primary_light:"#f8fafc", primary_dark:"#64748b", secondary:"#cbd5e1", accent:"#e2e8f0", surface:"#161b22", surface2:"#21262d", border:"#30363d", text:"#f0f6fc", text_muted:"#8b949e", text_inverse:"#0d1117", heading_font:"Space Grotesk", body_font:"Space Grotesk", icon_weight:"sharp", animation_speed:"slow", animation_style:"smooth", easing:"ease-out" },
  Mint: { desc:"Fresh green, approachable", background:"#f5fffb", primary:"#059669", primary_light:"#ecfdf5", primary_dark:"#047857", secondary:"#6ee7b7", accent:"#10b981", surface:"#ffffff", surface2:"#f0fdf8", border:"#d1fae5", text:"#052e20", text_muted:"#4a7c6a", text_inverse:"#ffffff", heading_font:"DM Sans", body_font:"DM Sans", icon_weight:"rounded", animation_speed:"medium", animation_style:"gentle", easing:"spring" },

  // ── Education ───────────────────────────────────────────────────────────────
  Campus: { desc:"Friendly blue, warm, open", background:"#f8faff", primary:"#2563eb", primary_light:"#eff6ff", primary_dark:"#1d4ed8", secondary:"#93c5fd", accent:"#60a5fa", surface:"#ffffff", surface2:"#f0f5ff", border:"#dbeafe", text:"#0f172a", text_muted:"#64748b", text_inverse:"#ffffff", heading_font:"Nunito", body_font:"Nunito", icon_weight:"rounded", animation_speed:"medium", animation_style:"gentle", easing:"spring" },
  Scholar: { desc:"Deep teal, academic authority", background:"#f8fcfb", primary:"#0f766e", primary_light:"#f0fdfa", primary_dark:"#0d5e57", secondary:"#5eead4", accent:"#14b8a6", surface:"#ffffff", surface2:"#f0faf8", border:"#ccebe7", text:"#0a2420", text_muted:"#4d7872", text_inverse:"#ffffff", heading_font:"Lora", body_font:"DM Sans", icon_weight:"outlined", animation_speed:"slow", animation_style:"smooth", easing:"ease-out" },
  Kids: { desc:"Bright, playful, age appropriate", background:"#fffef5", primary:"#f97316", primary_light:"#fff7ed", primary_dark:"#ea580c", secondary:"#fbbf24", accent:"#a855f7", surface:"#ffffff", surface2:"#fffae8", border:"#fde68a", text:"#1c0a00", text_muted:"#8c6a3a", text_inverse:"#ffffff", heading_font:"Nunito", body_font:"Nunito", icon_weight:"rounded", animation_speed:"fast", animation_style:"snappy", easing:"spring" },
  Focus: { desc:"Pure white, distraction-free", background:"#ffffff", primary:"#18181b", primary_light:"#f4f4f5", primary_dark:"#09090b", secondary:"#71717a", accent:"#3f3f46", surface:"#ffffff", surface2:"#fafafa", border:"#e4e4e7", text:"#09090b", text_muted:"#71717a", text_inverse:"#ffffff", heading_font:"Inter", body_font:"Inter", icon_weight:"outlined", animation_speed:"fast", animation_style:"snappy", easing:"linear" },
  Academy: { desc:"Dark mode, gold, premium courses", background:"#0d0d14", primary:"#d4af37", primary_light:"#fefce8", primary_dark:"#a88c2c", secondary:"#fde68a", accent:"#f5d060", surface:"#141420", surface2:"#1c1c2c", border:"#282838", text:"#f0eefc", text_muted:"#8888aa", text_inverse:"#0d0d14", heading_font:"Cormorant", body_font:"DM Sans", icon_weight:"outlined", animation_speed:"medium", animation_style:"smooth", easing:"ease-out" },

  // ── Travel & Lifestyle ──────────────────────────────────────────────────────
  Wanderlust: { desc:"Immersive dark, photography first", background:"#0a0a0a", primary:"#f97316", primary_light:"#fff7ed", primary_dark:"#ea580c", secondary:"#fb923c", accent:"#f59e0b", surface:"#141414", surface2:"#1e1e1e", border:"#2a2a2a", text:"#f5f5f5", text_muted:"#a0a0a0", text_inverse:"#0a0a0a", heading_font:"Syne", body_font:"DM Sans", icon_weight:"rounded", animation_speed:"medium", animation_style:"gentle", easing:"spring" },
  Resort: { desc:"Sand tones, luxury serif", background:"#fdfaf6", primary:"#c0956f", primary_light:"#fdf6f0", primary_dark:"#a07050", secondary:"#e8c9a8", accent:"#d4a574", surface:"#ffffff", surface2:"#fdf5ed", border:"#f0dfc8", text:"#2c1810", text_muted:"#9c7c6a", text_inverse:"#ffffff", heading_font:"Cormorant", body_font:"DM Sans", icon_weight:"rounded", animation_speed:"slow", animation_style:"smooth", easing:"ease-out" },
  Adventure: { desc:"Earthy, rugged, outdoorsy", background:"#faf7f4", primary:"#78350f", primary_light:"#fef3c7", primary_dark:"#5c2a0c", secondary:"#92400e", accent:"#d97706", surface:"#ffffff", surface2:"#f5ede4", border:"#e8d5c0", text:"#1c0f00", text_muted:"#7a5c40", text_inverse:"#ffffff", heading_font:"Space Grotesk", body_font:"DM Sans", icon_weight:"rounded", animation_speed:"fast", animation_style:"snappy", easing:"spring" },
  "City Guide": { desc:"Editorial, journalistic", background:"#ffffff", primary:"#1e293b", primary_light:"#f8fafc", primary_dark:"#0f172a", secondary:"#475569", accent:"#f97316", surface:"#ffffff", surface2:"#f8fafc", border:"#e2e8f0", text:"#0f172a", text_muted:"#64748b", text_inverse:"#ffffff", heading_font:"Lora", body_font:"Inter", icon_weight:"outlined", animation_speed:"medium", animation_style:"smooth", easing:"ease-out" },
  Nomad: { desc:"Warm minimal, borderless", background:"#faf8f5", primary:"#a08060", primary_light:"#fdf8f4", primary_dark:"#806040", secondary:"#c8a888", accent:"#b89070", surface:"#ffffff", surface2:"#f5f0ea", border:"#e8e0d5", text:"#2a1e14", text_muted:"#8a7060", text_inverse:"#ffffff", heading_font:"DM Sans", body_font:"DM Sans", icon_weight:"rounded", animation_speed:"slow", animation_style:"gentle", easing:"spring" },

  // ── Retail & Fashion ────────────────────────────────────────────────────────
  "Shopify Clean": { desc:"Minimal, conversion focused", background:"#f9fafb", primary:"#5c6ac4", primary_light:"#f4f5fa", primary_dark:"#4959bd", secondary:"#9da5d4", accent:"#47c1bf", surface:"#ffffff", surface2:"#f4f6f8", border:"#e1e3e5", text:"#212b36", text_muted:"#637381", text_inverse:"#ffffff", heading_font:"Inter", body_font:"Inter", icon_weight:"outlined", animation_speed:"fast", animation_style:"snappy", easing:"ease-out" },
  "Luxe Retail": { desc:"Black & white editorial", background:"#ffffff", primary:"#000000", primary_light:"#f5f5f5", primary_dark:"#000000", secondary:"#333333", accent:"#c0a060", surface:"#ffffff", surface2:"#f9f9f9", border:"#e0e0e0", text:"#000000", text_muted:"#666666", text_inverse:"#ffffff", heading_font:"Cormorant", body_font:"Inter", icon_weight:"sharp", animation_speed:"slow", animation_style:"smooth", easing:"ease-out" },
  "Warm Market": { desc:"Craft feel, artisan trust", background:"#fdfaf5", primary:"#b45309", primary_light:"#fffbeb", primary_dark:"#92400e", secondary:"#d97706", accent:"#f59e0b", surface:"#ffffff", surface2:"#fef8ee", border:"#fde8c0", text:"#1c0f00", text_muted:"#8c6a3a", text_inverse:"#ffffff", heading_font:"Lora", body_font:"DM Sans", icon_weight:"rounded", animation_speed:"medium", animation_style:"gentle", easing:"spring" },
  "Flash Sale": { desc:"Urgency built into the design", background:"#ffffff", primary:"#dc2626", primary_light:"#fef2f2", primary_dark:"#b91c1c", secondary:"#fca5a5", accent:"#facc15", surface:"#ffffff", surface2:"#fef2f2", border:"#fecaca", text:"#0a0a0a", text_muted:"#555555", text_inverse:"#ffffff", heading_font:"Syne", body_font:"Inter", icon_weight:"sharp", animation_speed:"fast", animation_style:"snappy", easing:"linear" },
  Boutique: { desc:"Dusty rose, curated, lifestyle", background:"#fdf8f9", primary:"#be8a9d", primary_light:"#fdf4f6", primary_dark:"#9e6a7d", secondary:"#e8c4ce", accent:"#d4a0b0", surface:"#ffffff", surface2:"#faf0f3", border:"#f5e0e5", text:"#2a1018", text_muted:"#9a7080", text_inverse:"#ffffff", heading_font:"Playfair Display", body_font:"DM Sans", icon_weight:"rounded", animation_speed:"slow", animation_style:"gentle", easing:"spring" },

  // ── Social & Community ──────────────────────────────────────────────────────
  Connect: { desc:"Vibrant blue, energetic", background:"#f8faff", primary:"#2563eb", primary_light:"#eff6ff", primary_dark:"#1d4ed8", secondary:"#93c5fd", accent:"#06b6d4", surface:"#ffffff", surface2:"#f0f5ff", border:"#dbeafe", text:"#0f172a", text_muted:"#64748b", text_inverse:"#ffffff", heading_font:"Nunito", body_font:"Nunito", icon_weight:"rounded", animation_speed:"fast", animation_style:"snappy", easing:"spring" },
  "Dark Social": { desc:"Near black, neon, Gen Z", background:"#09090b", primary:"#a855f7", primary_light:"#faf5ff", primary_dark:"#9333ea", secondary:"#d8b4fe", accent:"#ec4899", surface:"#111113", surface2:"#18181b", border:"#27272a", text:"#fafafa", text_muted:"#a1a1aa", text_inverse:"#09090b", heading_font:"Syne", body_font:"DM Sans", icon_weight:"rounded", animation_speed:"fast", animation_style:"snappy", easing:"spring" },
  "Warm Community": { desc:"Amber, inclusive, cozy", background:"#fffdf8", primary:"#d97706", primary_light:"#fffbeb", primary_dark:"#b45309", secondary:"#fcd34d", accent:"#f59e0b", surface:"#ffffff", surface2:"#fef9ec", border:"#fde68a", text:"#1c0f00", text_muted:"#8c6a3a", text_inverse:"#ffffff", heading_font:"DM Sans", body_font:"DM Sans", icon_weight:"rounded", animation_speed:"medium", animation_style:"gentle", easing:"spring" },
  Creator: { desc:"Gradient-heavy, content-first", background:"#0f0f14", primary:"#6366f1", primary_light:"#eef2ff", primary_dark:"#4f46e5", secondary:"#a5b4fc", accent:"#ec4899", surface:"#16161e", surface2:"#1e1e2e", border:"#282838", text:"#f0eeff", text_muted:"#8888bb", text_inverse:"#0f0f14", heading_font:"Syne", body_font:"DM Sans", icon_weight:"rounded", animation_speed:"fast", animation_style:"smooth", easing:"spring" },
  Forum: { desc:"Clean structure, Reddit familiar", background:"#ffffff", primary:"#ff6600", primary_light:"#fff7f0", primary_dark:"#cc5200", secondary:"#ffab80", accent:"#ff8533", surface:"#ffffff", surface2:"#f6f6ef", border:"#e8e8e0", text:"#000000", text_muted:"#828282", text_inverse:"#ffffff", heading_font:"Inter", body_font:"Inter", icon_weight:"outlined", animation_speed:"fast", animation_style:"snappy", easing:"linear" },

  // ── Fitness & Sport ─────────────────────────────────────────────────────────
  Power: { desc:"Bold black, electric yellow", background:"#0a0a0a", primary:"#facc15", primary_light:"#fefce8", primary_dark:"#eab308", secondary:"#fde68a", accent:"#f97316", surface:"#111111", surface2:"#1a1a1a", border:"#2a2a2a", text:"#f5f5f5", text_muted:"#a0a0a0", text_inverse:"#0a0a0a", heading_font:"Space Grotesk", body_font:"Space Grotesk", icon_weight:"sharp", animation_speed:"fast", animation_style:"snappy", easing:"ease-out" },
  Athletic: { desc:"Clean white, electric blue", background:"#ffffff", primary:"#2563eb", primary_light:"#eff6ff", primary_dark:"#1d4ed8", secondary:"#60a5fa", accent:"#0ea5e9", surface:"#ffffff", surface2:"#f8faff", border:"#e0eaff", text:"#0a0a14", text_muted:"#5a6a8a", text_inverse:"#ffffff", heading_font:"Inter", body_font:"Inter", icon_weight:"sharp", animation_speed:"fast", animation_style:"snappy", easing:"ease-out" },
  Zen: { desc:"Soft green, breathable, yoga", background:"#f8fcf9", primary:"#4d7c5f", primary_light:"#f0faf3", primary_dark:"#3a5e47", secondary:"#a7c4b0", accent:"#6aab82", surface:"#ffffff", surface2:"#eef6f1", border:"#d4ead9", text:"#1a2e22", text_muted:"#6b8a76", text_inverse:"#ffffff", heading_font:"DM Sans", body_font:"DM Sans", icon_weight:"rounded", animation_speed:"slow", animation_style:"gentle", easing:"spring" },
  Gains: { desc:"Dark red, gym culture, intense", background:"#0a0505", primary:"#dc2626", primary_light:"#fef2f2", primary_dark:"#b91c1c", secondary:"#fca5a5", accent:"#f97316", surface:"#140a0a", surface2:"#1e1010", border:"#2e1818", text:"#f5f0f0", text_muted:"#a08080", text_inverse:"#0a0505", heading_font:"Syne", body_font:"Space Grotesk", icon_weight:"sharp", animation_speed:"fast", animation_style:"snappy", easing:"ease-out" },
  Track: { desc:"Dark data, stats, precision", background:"#0a0f14", primary:"#0ea5e9", primary_light:"#f0f9ff", primary_dark:"#0284c7", secondary:"#7dd3fc", accent:"#06b6d4", surface:"#111820", surface2:"#18232e", border:"#1e2e3e", text:"#e2f0f8", text_muted:"#6a8fa8", text_inverse:"#0a0f14", heading_font:"Geist", body_font:"Geist Mono", icon_weight:"outlined", animation_speed:"fast", animation_style:"smooth", easing:"linear" },

  // ── Real Estate ─────────────────────────────────────────────────────────────
  Estate: { desc:"Dark navy, gold, premium", background:"#0c1018", primary:"#b8860b", primary_light:"#fef9ee", primary_dark:"#92680a", secondary:"#d4af37", accent:"#c8a040", surface:"#141c28", surface2:"#1c2838", border:"#243048", text:"#f0eefc", text_muted:"#8088a8", text_inverse:"#0c1018", heading_font:"Cormorant", body_font:"DM Sans", icon_weight:"outlined", animation_speed:"slow", animation_style:"smooth", easing:"ease-out" },
  "Modern Property": { desc:"Clean grey, minimal", background:"#f8fafc", primary:"#334155", primary_light:"#f8fafc", primary_dark:"#1e293b", secondary:"#64748b", accent:"#0ea5e9", surface:"#ffffff", surface2:"#f1f5f9", border:"#e2e8f0", text:"#0f172a", text_muted:"#64748b", text_inverse:"#ffffff", heading_font:"Inter", body_font:"Inter", icon_weight:"outlined", animation_speed:"medium", animation_style:"smooth", easing:"ease-out" },
  "Warm Home": { desc:"Terracotta, welcoming", background:"#fdf8f4", primary:"#c2714f", primary_light:"#fdf4f0", primary_dark:"#a05030", secondary:"#e8a888", accent:"#d4845e", surface:"#ffffff", surface2:"#faf2ec", border:"#f0ddd0", text:"#2c1408", text_muted:"#9c7060", text_inverse:"#ffffff", heading_font:"Lora", body_font:"DM Sans", icon_weight:"rounded", animation_speed:"slow", animation_style:"gentle", easing:"spring" },
  Urban: { desc:"Concrete editorial, architectural", background:"#0f0f0f", primary:"#475569", primary_light:"#f8fafc", primary_dark:"#334155", secondary:"#94a3b8", accent:"#f97316", surface:"#1a1a1a", surface2:"#242424", border:"#333333", text:"#f5f5f5", text_muted:"#888888", text_inverse:"#0f0f0f", heading_font:"Space Grotesk", body_font:"Inter", icon_weight:"sharp", animation_speed:"fast", animation_style:"snappy", easing:"ease-out" },
  Luxury: { desc:"All black platinum, trust", background:"#000000", primary:"#c0c0c0", primary_light:"#f8f8f8", primary_dark:"#a0a0a0", secondary:"#e0e0e0", accent:"#d4af37", surface:"#080808", surface2:"#101010", border:"#181818", text:"#f8f8f8", text_muted:"#888888", text_inverse:"#000000", heading_font:"Geist", body_font:"Geist", icon_weight:"sharp", animation_speed:"slow", animation_style:"smooth", easing:"ease-out" },

  // ── Transport & Logistics ───────────────────────────────────────────────────
  Drive: { desc:"Clean slate, Uber-like precision", background:"#ffffff", primary:"#000000", primary_light:"#f5f5f5", primary_dark:"#000000", secondary:"#333333", accent:"#2563eb", surface:"#ffffff", surface2:"#f5f5f5", border:"#e0e0e0", text:"#000000", text_muted:"#666666", text_inverse:"#ffffff", heading_font:"Inter", body_font:"Inter", icon_weight:"sharp", animation_speed:"fast", animation_style:"snappy", easing:"ease-out" },
  Fleet: { desc:"Dark navy, operational, B2B", background:"#0f1520", primary:"#1e40af", primary_light:"#eff6ff", primary_dark:"#1e3a8a", secondary:"#64748b", accent:"#f59e0b", surface:"#161e2e", surface2:"#1e2a3e", border:"#28384e", text:"#e0e8f0", text_muted:"#6080a0", text_inverse:"#0f1520", heading_font:"Space Grotesk", body_font:"Inter", icon_weight:"sharp", animation_speed:"medium", animation_style:"smooth", easing:"linear" },
  Speed: { desc:"Bold orange, urgency, delivery", background:"#ffffff", primary:"#f97316", primary_light:"#fff7ed", primary_dark:"#ea580c", secondary:"#fb923c", accent:"#facc15", surface:"#ffffff", surface2:"#fff7f0", border:"#fed7aa", text:"#0a0a0a", text_muted:"#555555", text_inverse:"#ffffff", heading_font:"Syne", body_font:"DM Sans", icon_weight:"sharp", animation_speed:"fast", animation_style:"snappy", easing:"spring" },
  Route: { desc:"Map green, wayfinding", background:"#f8fffe", primary:"#16a34a", primary_light:"#f0fdf4", primary_dark:"#15803d", secondary:"#86efac", accent:"#0ea5e9", surface:"#ffffff", surface2:"#f0fdf4", border:"#dcfce7", text:"#052e16", text_muted:"#4a7a5a", text_inverse:"#ffffff", heading_font:"DM Sans", body_font:"DM Sans", icon_weight:"rounded", animation_speed:"medium", animation_style:"smooth", easing:"ease-out" },
  Cargo: { desc:"Dark industrial, serious", background:"#080808", primary:"#78350f", primary_light:"#fef3c7", primary_dark:"#5c2a0c", secondary:"#d97706", accent:"#f59e0b", surface:"#121212", surface2:"#1c1c1c", border:"#2a2a2a", text:"#f0ece0", text_muted:"#8a8070", text_inverse:"#080808", heading_font:"Geist", body_font:"Space Grotesk", icon_weight:"sharp", animation_speed:"fast", animation_style:"snappy", easing:"linear" },

  // ── AI & Technology ─────────────────────────────────────────────────────────
  Neural: { desc:"Dark, precise, electric blue", background:"#030712", primary:"#3b82f6", primary_light:"#eff6ff", primary_dark:"#2563eb", secondary:"#93c5fd", accent:"#6366f1", surface:"#0a0f1e", surface2:"#111827", border:"#1f2937", text:"#f9fafb", text_muted:"#6b7280", text_inverse:"#030712", heading_font:"Geist", body_font:"Geist", icon_weight:"sharp", animation_speed:"fast", animation_style:"snappy", easing:"linear" },
  Clarity: { desc:"Clean white, trustworthy AI", background:"#ffffff", primary:"#2563eb", primary_light:"#eff6ff", primary_dark:"#1d4ed8", secondary:"#93c5fd", accent:"#6366f1", surface:"#ffffff", surface2:"#f8faff", border:"#e0eaff", text:"#0a0f1e", text_muted:"#64748b", text_inverse:"#ffffff", heading_font:"Inter", body_font:"Inter", icon_weight:"outlined", animation_speed:"medium", animation_style:"smooth", easing:"ease-out" },
  Terminal: { desc:"Green on black, brutalist", background:"#000000", primary:"#00ff41", primary_light:"#f0fff4", primary_dark:"#00cc33", secondary:"#00cc33", accent:"#00ffaa", surface:"#0a0a0a", surface2:"#111111", border:"#1a1a1a", text:"#00ff41", text_muted:"#007a1f", text_inverse:"#000000", heading_font:"Courier Prime", body_font:"Courier Prime", icon_weight:"sharp", animation_speed:"fast", animation_style:"snappy", easing:"linear" },
  Gradient: { desc:"Bold purple, glassmorphism", background:"#0f0a1a", primary:"#7c3aed", primary_light:"#faf5ff", primary_dark:"#6d28d9", secondary:"#a78bfa", accent:"#ec4899", surface:"#18102a", surface2:"#22183a", border:"#2e2048", text:"#faf5ff", text_muted:"#9080b8", text_inverse:"#0f0a1a", heading_font:"Syne", body_font:"DM Sans", icon_weight:"rounded", animation_speed:"medium", animation_style:"smooth", easing:"spring" },
  Pulse: { desc:"Dark cyan, live data energy", background:"#030f14", primary:"#06b6d4", primary_light:"#ecfeff", primary_dark:"#0891b2", secondary:"#67e8f9", accent:"#22d3ee", surface:"#071820", surface2:"#0e2430", border:"#143040", text:"#ecfeff", text_muted:"#4a8fa8", text_inverse:"#030f14", heading_font:"Space Grotesk", body_font:"Space Grotesk", icon_weight:"sharp", animation_speed:"fast", animation_style:"smooth", easing:"linear" },

  // ── Developer Tools ─────────────────────────────────────────────────────────
  // Terminal is shared with AI & Technology (above)
  IDE: { desc:"VS Code familiar, comfortable", background:"#1e1e1e", primary:"#569cd6", primary_light:"#1e3a5f", primary_dark:"#4080b0", secondary:"#9cdcfe", accent:"#4ec9b0", surface:"#252526", surface2:"#2d2d30", border:"#3e3e42", text:"#d4d4d4", text_muted:"#808080", text_inverse:"#1e1e1e", heading_font:"Geist", body_font:"Geist Mono", icon_weight:"outlined", animation_speed:"fast", animation_style:"snappy", easing:"linear" },
  Docs: { desc:"Clean white, documentation", background:"#ffffff", primary:"#2563eb", primary_light:"#eff6ff", primary_dark:"#1d4ed8", secondary:"#93c5fd", accent:"#6366f1", surface:"#ffffff", surface2:"#f8fafc", border:"#e2e8f0", text:"#0f172a", text_muted:"#64748b", text_inverse:"#ffffff", heading_font:"Inter", body_font:"Inter", icon_weight:"outlined", animation_speed:"medium", animation_style:"smooth", easing:"ease-out" },
  API: { desc:"Dark green, technical authority", background:"#0a0f0a", primary:"#10b981", primary_light:"#ecfdf5", primary_dark:"#059669", secondary:"#6ee7b7", accent:"#06b6d4", surface:"#111811", surface2:"#182018", border:"#1e2e1e", text:"#ecfdf5", text_muted:"#4a8a5a", text_inverse:"#0a0f0a", heading_font:"Geist", body_font:"Geist Mono", icon_weight:"sharp", animation_speed:"fast", animation_style:"snappy", easing:"linear" },
  Debug: { desc:"Dark red, urgency, error states", background:"#0f0808", primary:"#ef4444", primary_light:"#fef2f2", primary_dark:"#dc2626", secondary:"#fca5a5", accent:"#f97316", surface:"#1a1010", surface2:"#221818", border:"#2e2020", text:"#fef2f2", text_muted:"#a07070", text_inverse:"#0f0808", heading_font:"Space Grotesk", body_font:"Geist Mono", icon_weight:"sharp", animation_speed:"fast", animation_style:"snappy", easing:"linear" },

  // ── Entertainment & Media ───────────────────────────────────────────────────
  Stream: { desc:"Dark, content-first, immersive", background:"#141414", primary:"#e50914", primary_light:"#fef2f2", primary_dark:"#b8070f", secondary:"#ff4d55", accent:"#e50914", surface:"#1f1f1f", surface2:"#2a2a2a", border:"#333333", text:"#ffffff", text_muted:"#aaaaaa", text_inverse:"#141414", heading_font:"Inter", body_font:"Inter", icon_weight:"rounded", animation_speed:"fast", animation_style:"smooth", easing:"ease-out" },
  Podcast: { desc:"Warm dark, editorial, audio", background:"#1c1520", primary:"#8b5cf6", primary_light:"#faf5ff", primary_dark:"#7c3aed", secondary:"#c4b5fd", accent:"#a78bfa", surface:"#26202e", surface2:"#302838", border:"#3e3048", text:"#f5f0fc", text_muted:"#8870a8", text_inverse:"#1c1520", heading_font:"Lora", body_font:"DM Sans", icon_weight:"rounded", animation_speed:"medium", animation_style:"gentle", easing:"spring" },
  Gaming: { desc:"Neon on black, immersive", background:"#050010", primary:"#a855f7", primary_light:"#faf5ff", primary_dark:"#9333ea", secondary:"#06b6d4", accent:"#10b981", surface:"#0a0820", surface2:"#100f2e", border:"#1a1840", text:"#f0eeff", text_muted:"#6060aa", text_inverse:"#050010", heading_font:"Syne", body_font:"Space Grotesk", icon_weight:"sharp", animation_speed:"fast", animation_style:"snappy", easing:"spring" },
  Magazine: { desc:"Editorial grid, photography", background:"#ffffff", primary:"#1e293b", primary_light:"#f8fafc", primary_dark:"#0f172a", secondary:"#475569", accent:"#dc2626", surface:"#ffffff", surface2:"#f8f8f8", border:"#e0e0e0", text:"#0f172a", text_muted:"#64748b", text_inverse:"#ffffff", heading_font:"Cormorant", body_font:"Inter", icon_weight:"outlined", animation_speed:"slow", animation_style:"smooth", easing:"ease-out" },
  Spotlight: { desc:"Black gold, theatrical events", background:"#000000", primary:"#d4af37", primary_light:"#fefce8", primary_dark:"#a88c2c", secondary:"#f5d060", accent:"#fbbf24", surface:"#0a0a0a", surface2:"#141414", border:"#1e1e1e", text:"#f5f5f5", text_muted:"#888888", text_inverse:"#000000", heading_font:"Playfair Display", body_font:"DM Sans", icon_weight:"sharp", animation_speed:"slow", animation_style:"smooth", easing:"ease-out" },

  // ── Events & Ticketing ──────────────────────────────────────────────────────
  Stage: { desc:"Dramatic black, spotlight gold", background:"#000000", primary:"#f5d060", primary_light:"#fefce8", primary_dark:"#d4af37", secondary:"#fbbf24", accent:"#f97316", surface:"#0d0d0d", surface2:"#1a1a1a", border:"#252525", text:"#f5f5f5", text_muted:"#909090", text_inverse:"#000000", heading_font:"Syne", body_font:"DM Sans", icon_weight:"sharp", animation_speed:"medium", animation_style:"smooth", easing:"ease-out" },
  Festival: { desc:"Maximalist, vibrant poster energy", background:"#0a0008", primary:"#f97316", primary_light:"#fff7ed", primary_dark:"#ea580c", secondary:"#facc15", accent:"#a855f7", surface:"#140010", surface2:"#1e0018", border:"#2e0028", text:"#fff0fe", text_muted:"#a060a0", text_inverse:"#0a0008", heading_font:"Space Grotesk", body_font:"Syne", icon_weight:"rounded", animation_speed:"fast", animation_style:"snappy", easing:"spring" },
  "Corporate Event": { desc:"Clean navy, professional", background:"#f8fafc", primary:"#1e40af", primary_light:"#eff6ff", primary_dark:"#1e3a8a", secondary:"#93c5fd", accent:"#0ea5e9", surface:"#ffffff", surface2:"#f1f5f9", border:"#e2e8f0", text:"#0f172a", text_muted:"#64748b", text_inverse:"#ffffff", heading_font:"Inter", body_font:"Inter", icon_weight:"outlined", animation_speed:"medium", animation_style:"smooth", easing:"ease-out" },
  Party: { desc:"Neon dark, celebratory", background:"#080010", primary:"#ec4899", primary_light:"#fdf2f8", primary_dark:"#db2777", secondary:"#a855f7", accent:"#06b6d4", surface:"#100020", surface2:"#180030", border:"#240048", text:"#fdf0ff", text_muted:"#9060b0", text_inverse:"#080010", heading_font:"Syne", body_font:"DM Sans", icon_weight:"rounded", animation_speed:"fast", animation_style:"snappy", easing:"spring" },
  Intimate: { desc:"Warm serif, artisan craft", background:"#fdfaf6", primary:"#92400e", primary_light:"#fffbeb", primary_dark:"#78350f", secondary:"#d97706", accent:"#b45309", surface:"#ffffff", surface2:"#fef9f0", border:"#fde8c8", text:"#1c1008", text_muted:"#8c6a48", text_inverse:"#ffffff", heading_font:"Lora", body_font:"DM Sans", icon_weight:"rounded", animation_speed:"slow", animation_style:"gentle", easing:"spring" },

  // ── SaaS & Productivity (shared / available for all) ────────────────────────
  Linear: { desc:"Dark, precise, developer-beloved", background:"#0f0f12", primary:"#5e6ad2", primary_light:"#eef0ff", primary_dark:"#4a54c0", secondary:"#9da3e8", accent:"#7c85e0", surface:"#16161a", surface2:"#1c1c22", border:"#282830", text:"#f0f0f8", text_muted:"#6868a0", text_inverse:"#0f0f12", heading_font:"Geist", body_font:"Geist", icon_weight:"sharp", animation_speed:"fast", animation_style:"snappy", easing:"ease-out" },
  Notion: { desc:"Warm white, clean blocks", background:"#ffffff", primary:"#2e2e2e", primary_light:"#f7f6f3", primary_dark:"#1a1a1a", secondary:"#6b6b6b", accent:"#2383e2", surface:"#ffffff", surface2:"#f7f6f3", border:"#e9e9e7", text:"#2e2e2e", text_muted:"#9b9b9b", text_inverse:"#ffffff", heading_font:"Inter", body_font:"Inter", icon_weight:"outlined", animation_speed:"medium", animation_style:"smooth", easing:"ease-out" },
  Dashboard: { desc:"Data-rich, navy, enterprise", background:"#0f172a", primary:"#4f46e5", primary_light:"#eef2ff", primary_dark:"#4338ca", secondary:"#818cf8", accent:"#06b6d4", surface:"#1e293b", surface2:"#273548", border:"#334155", text:"#f1f5f9", text_muted:"#64748b", text_inverse:"#0f172a", heading_font:"Space Grotesk", body_font:"Inter", icon_weight:"outlined", animation_speed:"medium", animation_style:"smooth", easing:"linear" },
  Command: { desc:"Terminal energy, power user", background:"#000000", primary:"#10b981", primary_light:"#ecfdf5", primary_dark:"#059669", secondary:"#6ee7b7", accent:"#06b6d4", surface:"#0a0a0a", surface2:"#111111", border:"#1a1a1a", text:"#00ff88", text_muted:"#006633", text_inverse:"#000000", heading_font:"Geist Mono", body_font:"Geist Mono", icon_weight:"sharp", animation_speed:"fast", animation_style:"snappy", easing:"linear" },

  // ── Standalone / universal themes ───────────────────────────────────────────
  Noir: { desc:"Dark, minimal, cyan accents", background:"#050505", primary:"#06b6d4", primary_light:"#ecfeff", primary_dark:"#0891b2", secondary:"#67e8f9", accent:"#22d3ee", surface:"#0a0a0a", surface2:"#111111", border:"#1a1a1a", text:"#f0feff", text_muted:"#4a8090", text_inverse:"#050505", heading_font:"Space Grotesk", body_font:"DM Sans", icon_weight:"sharp", animation_speed:"medium", animation_style:"smooth", easing:"ease-out" },
  Aurora: { desc:"Deep gradient, bold expressive", background:"#0f0c29", primary:"#a78bfa", primary_light:"#f5f3ff", primary_dark:"#7c3aed", secondary:"#c4b5fd", accent:"#ec4899", surface:"rgba(255,255,255,0.06)", surface2:"rgba(255,255,255,0.1)", border:"rgba(255,255,255,0.15)", text:"#ffffff", text_muted:"rgba(255,255,255,0.5)", text_inverse:"#0f0c29", heading_font:"Syne", body_font:"DM Sans", icon_weight:"rounded", animation_speed:"slow", animation_style:"smooth", easing:"spring" },
  Paper: { desc:"Warm neutral, editorial", background:"#fafaf8", primary:"#292524", primary_light:"#fafaf8", primary_dark:"#1c1917", secondary:"#78716c", accent:"#a8a29e", surface:"#ffffff", surface2:"#f5f4f0", border:"#e7e5e4", text:"#1c1917", text_muted:"#78716c", text_inverse:"#fafaf8", heading_font:"Lora", body_font:"DM Sans", icon_weight:"outlined", animation_speed:"medium", animation_style:"gentle", easing:"spring" },
};

// ─── Industry → 5 recommended theme names (from zeach-industry-brains) ────────
// Keys match industry_name from the brain JSON files (used in projects.industry column)

export const INDUSTRY_THEME_NAMES: Record<string, string[]> = {
  "AI & Technology":      ["Neural", "Clarity", "Terminal", "Gradient", "Pulse"],
  "Beauty & Wellness":    ["Sakura", "Luxe", "Fresh", "Glow", "Petal"],
  "Developer Tools":      ["Terminal", "IDE", "Docs", "API", "Debug"],
  "Education":            ["Campus", "Scholar", "Kids", "Focus", "Academy"],
  "Entertainment & Media":["Stream", "Podcast", "Gaming", "Magazine", "Spotlight"],
  "Events & Ticketing":   ["Stage", "Festival", "Corporate Event", "Party", "Intimate"],
  "Finance":              ["Slate", "Obsidian", "Nordic", "Vault", "Mint"],
  "Fitness & Sport":      ["Power", "Athletic", "Zen", "Gains", "Track"],
  "Food & Beverage":      ["Appetite", "Street Food", "Fresh Market", "Bistro", "Dark Kitchen"],
  "Healthcare":           ["Clinical", "Soft Care", "Modern Medical", "Wellness", "Emergency"],
  "Real Estate":          ["Estate", "Modern Property", "Warm Home", "Urban", "Luxury"],
  "Retail & Fashion":     ["Shopify Clean", "Luxe Retail", "Warm Market", "Flash Sale", "Boutique"],
  "Transport & Logistics":["Drive", "Fleet", "Speed", "Route", "Cargo"],
  "Travel & Lifestyle":   ["Wanderlust", "Resort", "Adventure", "City Guide", "Nomad"],
};

// Fallback themes shown when no matching industry is found
export const DEFAULT_THEME_NAMES = ["Noir", "Neural", "Clarity", "Paper", "Aurora"];

// ─── Industry → recommended font pairing (from zeach-industry-brains) ─────────

export const INDUSTRY_FONTS: Record<string, { heading: string; body: string }> = {
  "AI & Technology":      { heading: "Geist",           body: "Geist Mono" },
  "Beauty & Wellness":    { heading: "Playfair Display", body: "DM Sans" },
  "Developer Tools":      { heading: "Geist",           body: "Geist Mono" },
  "Education":            { heading: "Nunito",           body: "Nunito" },
  "Entertainment & Media":{ heading: "Inter",            body: "Inter" },
  "Events & Ticketing":   { heading: "Syne",             body: "DM Sans" },
  "Finance":              { heading: "Geist",            body: "Geist Mono" },
  "Fitness & Sport":      { heading: "Space Grotesk",    body: "Inter" },
  "Food & Beverage":      { heading: "Syne",             body: "DM Sans" },
  "Healthcare":           { heading: "Inter",            body: "Inter" },
  "Real Estate":          { heading: "Inter",            body: "Inter" },
  "Retail & Fashion":     { heading: "Inter",            body: "Inter" },
  "Transport & Logistics":{ heading: "Inter",            body: "Inter" },
  "Travel & Lifestyle":   { heading: "Syne",             body: "DM Sans" },
};

// ─── All font pairs used across the catalog ────────────────────────────────────

export type FontPairDef = {
  id: string;
  heading: string;
  body: string;
  mood: string;
  googleUrl: string; // empty string if not on Google Fonts
};

export const ALL_FONT_PAIRS: FontPairDef[] = [
  { id: "inter",           heading: "Inter",            body: "Inter",            mood: "Modern Sans",      googleUrl: "family=Inter:wght@400;500;600" },
  { id: "geist",           heading: "Geist",            body: "Geist",            mood: "Developer-first",  googleUrl: "" },
  { id: "geist-mono",      heading: "Geist",            body: "Geist Mono",       mood: "Technical",        googleUrl: "" },
  { id: "syne-dm",         heading: "Syne",             body: "DM Sans",          mood: "Expressive",       googleUrl: "family=Syne:wght@400;600;700&family=DM+Sans:wght@400;500" },
  { id: "space-inter",     heading: "Space Grotesk",    body: "Inter",            mood: "Bold & Geometric", googleUrl: "family=Space+Grotesk:wght@400;600;700&family=Inter:wght@400;500" },
  { id: "playfair-dm",     heading: "Playfair Display", body: "DM Sans",          mood: "Elegant",          googleUrl: "family=Playfair+Display:wght@400;600&family=DM+Sans:wght@400;500" },
  { id: "cormorant-nunito",heading: "Cormorant",        body: "Nunito",           mood: "Soft Luxury",      googleUrl: "family=Cormorant+Garamond:wght@400;600&family=Nunito:wght@400;500" },
  { id: "nunito",          heading: "Nunito",           body: "Nunito",           mood: "Friendly & Round", googleUrl: "family=Nunito:wght@400;500;600;700" },
  { id: "lora-dm",         heading: "Lora",             body: "DM Sans",          mood: "Editorial Serif",  googleUrl: "family=Lora:wght@400;600&family=DM+Sans:wght@400;500" },
];

/** Returns the FontPairDef that best matches the industry-recommended fonts. */
export function getRecommendedFontPair(industry: string): FontPairDef {
  const rec = INDUSTRY_FONTS[industry];
  if (!rec) return ALL_FONT_PAIRS[0];
  return (
    ALL_FONT_PAIRS.find((fp) => fp.heading === rec.heading && fp.body === rec.body) ??
    ALL_FONT_PAIRS.find((fp) => fp.heading === rec.heading) ??
    ALL_FONT_PAIRS[0]
  );
}

/** Returns the 5 ZeachTheme entries for a given industry. */
export function getIndustryThemes(industry: string): Array<{ name: string; theme: ZeachTheme }> {
  const names = INDUSTRY_THEME_NAMES[industry] ?? DEFAULT_THEME_NAMES;
  return names
    .map((n) => ({ name: n, theme: ZEACH_THEMES[n] }))
    .filter((entry): entry is { name: string; theme: ZeachTheme } => !!entry.theme);
}
