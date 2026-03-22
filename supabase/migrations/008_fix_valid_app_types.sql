-- ─────────────────────────────────────────────────────────────────────────────
-- 008_fix_valid_app_types.sql
-- Aligns industry.valid_app_types values with actual product archetype names.
-- Run AFTER 007_industry_product_brains.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ── AI & Technology ───────────────────────────────────────────────────────────
-- AI Assistant & Chatbot → AI Tool
-- AI Developer Tool      → Developer Tool
-- SaaS & Productivity    → Dashboard SaaS
UPDATE public.industries SET
  valid_app_types = ARRAY['AI Tool', 'Developer Tool', 'Dashboard SaaS']::text[],
  brain = jsonb_set(brain, '{valid_app_types}', '["AI Tool","Developer Tool","Dashboard SaaS"]'::jsonb)
WHERE slug = 'ai_technology';

-- ── Developer Tools ───────────────────────────────────────────────────────────
-- AI Developer Tool   → Developer Tool
-- SaaS & Productivity → Dashboard SaaS
UPDATE public.industries SET
  valid_app_types = ARRAY['Developer Tool', 'Dashboard SaaS']::text[],
  brain = jsonb_set(brain, '{valid_app_types}', '["Developer Tool","Dashboard SaaS"]'::jsonb)
WHERE slug = 'developer_tools';

-- ── Education & Learning ──────────────────────────────────────────────────────
-- Education & Learning → Content & Streaming
-- SaaS & Productivity  → Dashboard SaaS
UPDATE public.industries SET
  valid_app_types = ARRAY['Content & Streaming', 'Marketplace', 'Dashboard SaaS', 'Social & Community']::text[],
  brain = jsonb_set(brain, '{valid_app_types}', '["Content & Streaming","Marketplace","Dashboard SaaS","Social & Community"]'::jsonb)
WHERE slug = 'education';

-- ── Entertainment & Media ─────────────────────────────────────────────────────
-- Streaming → Content & Streaming
UPDATE public.industries SET
  valid_app_types = ARRAY['Social & Community', 'Marketplace', 'Content & Streaming']::text[],
  brain = jsonb_set(brain, '{valid_app_types}', '["Social & Community","Marketplace","Content & Streaming"]'::jsonb)
WHERE slug = 'entertainment';

-- ── Finance & Banking ─────────────────────────────────────────────────────────
-- Finance & Banking → Dashboard SaaS
-- SaaS & Productivity → Dashboard SaaS (deduplicated)
UPDATE public.industries SET
  valid_app_types = ARRAY['Dashboard SaaS', 'Marketplace']::text[],
  brain = jsonb_set(brain, '{valid_app_types}', '["Dashboard SaaS","Marketplace"]'::jsonb)
WHERE slug = 'finance';

-- ── Fitness & Sport ───────────────────────────────────────────────────────────
-- Health & Fitness → Content & Streaming
UPDATE public.industries SET
  valid_app_types = ARRAY['Content & Streaming', 'Booking & Appointments', 'Social & Community']::text[],
  brain = jsonb_set(brain, '{valid_app_types}', '["Content & Streaming","Booking & Appointments","Social & Community"]'::jsonb)
WHERE slug = 'fitness_sport';

-- ── Food & Beverage ───────────────────────────────────────────────────────────
-- Food & Delivery → removed (same as Marketplace, deduplicated)
UPDATE public.industries SET
  valid_app_types = ARRAY['Marketplace', 'Booking & Appointments', 'E-commerce']::text[],
  brain = jsonb_set(brain, '{valid_app_types}', '["Marketplace","Booking & Appointments","E-commerce"]'::jsonb)
WHERE slug = 'food_beverage';

-- ── Healthcare ────────────────────────────────────────────────────────────────
-- Health & Fitness    → Content & Streaming
-- SaaS & Productivity → Dashboard SaaS
-- (added)             → Chat / Messaging
UPDATE public.industries SET
  valid_app_types = ARRAY['Booking & Appointments', 'Content & Streaming', 'Dashboard SaaS', 'Chat / Messaging']::text[],
  brain = jsonb_set(brain, '{valid_app_types}', '["Booking & Appointments","Content & Streaming","Dashboard SaaS","Chat / Messaging"]'::jsonb)
WHERE slug = 'healthcare';

-- ── Real Estate & Property ────────────────────────────────────────────────────
-- SaaS & Productivity → Dashboard SaaS
-- (added)             → Map & Location-Based
UPDATE public.industries SET
  valid_app_types = ARRAY['Marketplace', 'Dashboard SaaS', 'Booking & Appointments', 'Map & Location-Based']::text[],
  brain = jsonb_set(brain, '{valid_app_types}', '["Marketplace","Dashboard SaaS","Booking & Appointments","Map & Location-Based"]'::jsonb)
WHERE slug = 'real_estate';

-- ── Transport & Logistics ─────────────────────────────────────────────────────
-- SaaS & Productivity → Dashboard SaaS
-- (added)             → Map & Location-Based
UPDATE public.industries SET
  valid_app_types = ARRAY['Booking & Appointments', 'Marketplace', 'Dashboard SaaS', 'Map & Location-Based']::text[],
  brain = jsonb_set(brain, '{valid_app_types}', '["Booking & Appointments","Marketplace","Dashboard SaaS","Map & Location-Based"]'::jsonb)
WHERE slug = 'transport_logistics';
