-- ─────────────────────────────────────────────────────────────────────────────
-- 014_update_themes_data.sql
-- Merges zeach-theme-tokens.json data into the themes table:
--   1. Add description column to themes table
--   2. Patch tokens JSONB with desc + animation_speed / animation_style / easing
--   3. Fix industry name mismatches (Education & Learning → Education, etc.)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Add description column (safe to re-run) ────────────────────────────────

ALTER TABLE public.themes
  ADD COLUMN IF NOT EXISTS description text;

-- ── 2. Fix industry name mismatches ──────────────────────────────────────────
-- The industry-brain JSONs use short names; migration 004 used long names.

UPDATE public.themes SET industry = 'Education'   WHERE industry = 'Education & Learning';
UPDATE public.themes SET industry = 'Finance'     WHERE industry = 'Finance & Banking';
UPDATE public.themes SET industry = 'Real Estate' WHERE industry = 'Real Estate & Property';

-- ── 3. Merge animation + desc data into tokens JSONB ─────────────────────────
-- Uses a single UPDATE with a VALUES list for efficiency.
-- Rows are matched by theme name (unique in zeach-theme-tokens).

UPDATE public.themes AS t
SET
  description = v.theme_desc,
  tokens = t.tokens || jsonb_build_object(
    'desc',            v.theme_desc,
    'animation_speed', v.animation_speed,
    'animation_style', v.animation_style,
    'easing',          v.easing
  )
FROM (VALUES
  -- Beauty & Wellness
  ('Sakura',          'Soft, feminine, pastel',             'slow',   'gentle', 'spring'),
  ('Luxe',            'Gold accents, premium dark',         'slow',   'smooth', 'ease-out'),
  ('Fresh',           'Clean botanical green',              'medium', 'gentle', 'spring'),
  ('Glow',            'Warm ivory, rose gold',              'slow',   'gentle', 'spring'),
  ('Petal',           'Lavender, lilac gradients',          'slow',   'gentle', 'spring'),
  -- Food & Beverage
  ('Appetite',        'Warm red, bold, high energy',        'fast',   'snappy', 'spring'),
  ('Street Food',     'Urban black, neon energy',           'fast',   'snappy', 'spring'),
  ('Fresh Market',    'Organic green, fresh',               'medium', 'gentle', 'spring'),
  ('Bistro',          'Warm cream, restaurant quality',     'medium', 'smooth', 'ease-out'),
  ('Dark Kitchen',    'Near black, amber accents',          'fast',   'snappy', 'ease-out'),
  -- Healthcare
  ('Clinical',        'Pure white, sterile precision',      'medium', 'smooth', 'ease-out'),
  ('Soft Care',       'Calming blue, warm whites',          'slow',   'gentle', 'spring'),
  ('Modern Medical',  'Dark tech, teal accents',            'fast',   'smooth', 'linear'),
  ('Wellness',        'Sage green, holistic',               'slow',   'gentle', 'spring'),
  ('Emergency',       'High contrast, zero confusion',      'fast',   'snappy', 'linear'),
  -- Finance
  ('Obsidian',        'Premium black, gold details',        'medium', 'smooth', 'ease-out'),
  ('Slate',           'Corporate grey, clean',              'medium', 'smooth', 'ease-out'),
  ('Nordic',          'Cold blue, Scandinavian minimal',    'medium', 'smooth', 'ease-out'),
  ('Vault',           'Deep navy, silver, secure',          'slow',   'smooth', 'ease-out'),
  ('Mint',            'Fresh green, approachable',          'medium', 'gentle', 'spring'),
  -- Education
  ('Campus',          'Friendly blue, warm, open',          'medium', 'gentle', 'spring'),
  ('Scholar',         'Deep teal, academic authority',      'slow',   'smooth', 'ease-out'),
  ('Kids',            'Bright, playful, age appropriate',   'fast',   'snappy', 'spring'),
  ('Focus',           'Pure white, distraction-free',       'fast',   'snappy', 'linear'),
  ('Academy',         'Dark mode, gold, premium courses',   'medium', 'smooth', 'ease-out'),
  -- Travel & Lifestyle
  ('Wanderlust',      'Immersive dark, photography first',  'medium', 'gentle', 'spring'),
  ('Resort',          'Sand tones, luxury serif',           'slow',   'smooth', 'ease-out'),
  ('Adventure',       'Earthy, rugged, outdoorsy',          'fast',   'snappy', 'spring'),
  ('City Guide',      'Editorial, journalistic',            'medium', 'smooth', 'ease-out'),
  ('Nomad',           'Warm minimal, borderless',           'slow',   'gentle', 'spring'),
  -- Retail & Fashion
  ('Shopify Clean',   'Minimal, conversion focused',        'fast',   'snappy', 'ease-out'),
  ('Luxe Retail',     'Black & white editorial',            'slow',   'smooth', 'ease-out'),
  ('Warm Market',     'Craft feel, artisan trust',          'medium', 'gentle', 'spring'),
  ('Flash Sale',      'Urgency built into the design',      'fast',   'snappy', 'linear'),
  ('Boutique',        'Dusty rose, curated, lifestyle',     'slow',   'gentle', 'spring'),
  -- Social & Community
  ('Connect',         'Vibrant blue, energetic',            'fast',   'snappy', 'spring'),
  ('Dark Social',     'Near black, neon, Gen Z',            'fast',   'snappy', 'spring'),
  ('Warm Community',  'Amber, inclusive, cozy',             'medium', 'gentle', 'spring'),
  ('Creator',         'Gradient-heavy, content-first',      'fast',   'smooth', 'spring'),
  ('Forum',           'Clean structure, Reddit familiar',   'fast',   'snappy', 'linear'),
  -- Fitness & Sport
  ('Power',           'Bold black, electric yellow',        'fast',   'snappy', 'ease-out'),
  ('Athletic',        'Clean white, electric blue',         'fast',   'snappy', 'ease-out'),
  ('Zen',             'Soft green, breathable, yoga',       'slow',   'gentle', 'spring'),
  ('Gains',           'Dark red, gym culture, intense',     'fast',   'snappy', 'ease-out'),
  ('Track',           'Dark data, stats, precision',        'fast',   'smooth', 'linear'),
  -- Real Estate
  ('Estate',          'Dark navy, gold, premium',           'slow',   'smooth', 'ease-out'),
  ('Modern Property', 'Clean grey, minimal',                'medium', 'smooth', 'ease-out'),
  ('Warm Home',       'Terracotta, welcoming',              'slow',   'gentle', 'spring'),
  ('Urban',           'Concrete editorial, architectural',  'fast',   'snappy', 'ease-out'),
  ('Luxury',          'All black platinum, trust',          'slow',   'smooth', 'ease-out'),
  -- Transport & Logistics
  ('Drive',           'Clean slate, Uber-like precision',   'fast',   'snappy', 'ease-out'),
  ('Fleet',           'Dark navy, operational, B2B',        'medium', 'smooth', 'linear'),
  ('Speed',           'Bold orange, urgency, delivery',     'fast',   'snappy', 'spring'),
  ('Route',           'Map green, wayfinding',              'medium', 'smooth', 'ease-out'),
  ('Cargo',           'Dark industrial, serious',           'fast',   'snappy', 'linear'),
  -- AI & Technology
  ('Neural',          'Dark, precise, electric blue',       'fast',   'snappy', 'linear'),
  ('Clarity',         'Clean white, trustworthy AI',        'medium', 'smooth', 'ease-out'),
  ('Terminal',        'Green on black, brutalist',          'fast',   'snappy', 'linear'),
  ('Gradient',        'Bold purple, glassmorphism',         'medium', 'smooth', 'spring'),
  ('Pulse',           'Dark cyan, live data energy',        'fast',   'smooth', 'linear'),
  -- Developer Tools
  ('IDE',             'VS Code familiar, comfortable',      'fast',   'snappy', 'linear'),
  ('Docs',            'Clean white, documentation',         'medium', 'smooth', 'ease-out'),
  ('API',             'Dark green, technical authority',    'fast',   'snappy', 'linear'),
  ('Debug',           'Dark red, urgency, error states',    'fast',   'snappy', 'linear'),
  -- Entertainment & Media
  ('Stream',          'Dark, content-first, immersive',     'fast',   'smooth', 'ease-out'),
  ('Podcast',         'Warm dark, editorial, audio',        'medium', 'gentle', 'spring'),
  ('Gaming',          'Neon on black, immersive',           'fast',   'snappy', 'spring'),
  ('Magazine',        'Editorial grid, photography',        'slow',   'smooth', 'ease-out'),
  ('Spotlight',       'Black gold, theatrical events',      'slow',   'smooth', 'ease-out'),
  -- Events & Ticketing
  ('Stage',           'Dramatic black, spotlight gold',     'medium', 'smooth', 'ease-out'),
  ('Festival',        'Maximalist, vibrant poster energy',  'fast',   'snappy', 'spring'),
  ('Corporate Event', 'Clean navy, professional',           'medium', 'smooth', 'ease-out'),
  ('Party',           'Neon dark, celebratory',             'fast',   'snappy', 'spring'),
  ('Intimate',        'Warm serif, artisan craft',          'slow',   'gentle', 'spring'),
  -- SaaS & Productivity
  ('Linear',          'Dark, precise, developer-beloved',   'fast',   'snappy', 'ease-out'),
  ('Notion',          'Warm white, clean blocks',           'medium', 'smooth', 'ease-out'),
  ('Dashboard',       'Data-rich, navy, enterprise',        'medium', 'smooth', 'linear'),
  ('Command',         'Terminal energy, power user',        'fast',   'snappy', 'linear'),
  -- Booking & Appointments (not in zeach-theme-tokens; keep existing)
  -- Marketplace (not in zeach-theme-tokens; keep existing)
  -- Standalone
  ('Noir',            'Dark, minimal, cyan accents',        'medium', 'smooth', 'ease-out'),
  ('Aurora',          'Deep gradient, bold expressive',     'slow',   'smooth', 'spring'),
  ('Paper',           'Warm neutral, editorial',            'medium', 'gentle', 'spring')
) AS v(theme_name, theme_desc, animation_speed, animation_style, easing)
WHERE t.name = v.theme_name;

-- ── 4. Verify ────────────────────────────────────────────────────────────────
-- SELECT industry, name, description, tokens->>'animation_speed' AS anim
-- FROM public.themes ORDER BY industry, sort_order LIMIT 20;
