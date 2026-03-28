import { createClient } from "@/lib/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────────────

// ─── Themes (formerly style_packs) ───────────────────────────────────────────

export type ThemeTokens = {
  primary: string;
  primary_light: string;
  primary_dark: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  text_muted: string;
  text_inverse: string;
  success: string;
  error: string;
  warning: string;
  heading_font: string;
  body_font: string;
  icon_weight: "rounded" | "sharp" | "outlined";
  gradient_start?: string;
  gradient_end?: string;
};

export type Theme = {
  id: string;
  industry: string;
  name: string;
  tokens: ThemeTokens;
  sort_order: number;
};

// ─── Global theme (formerly global_tokens) ────────────────────────────────────

// Known keys are typed precisely; any extra keys added to global_theme.tokens
// (e.g. "desktop", "grid", "z_index") are preserved as unknown so nothing is dropped.
export type GlobalTheme = {
  radius?: Record<string, string>;
  spacing?: Record<string, string>;
  font_sizes?: Record<string, string>;
  line_heights?: Record<string, string>;
  shadows?: Record<string, string>;
  transitions?: Record<string, string>;
  breakpoints?: Record<string, string>;
  desktop?: Record<string, unknown>;
} & { [key: string]: unknown };

export async function getThemes(industry?: string): Promise<Theme[]> {
  const supabase = createClient();
  let query = supabase
    .from("themes")
    .select("*")
    .order("sort_order", { ascending: true });
  if (industry) query = query.eq("industry", industry);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch a single theme by name from the DB.
 * Used when a theme card is clicked in Screen 2 — catalog handles display,
 * DB is the source of truth for generation tokens (inc. animation fields from migration 014).
 */
export async function getThemeByName(name: string): Promise<Theme | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("themes")
    .select("*")
    .eq("name", name)
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data as Theme | null;
}

export async function getThemesByIndustry(): Promise<Record<string, Theme[]>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("themes")
    .select("*")
    .order("industry")
    .order("sort_order");
  if (error) throw error;
  const grouped: Record<string, Theme[]> = {};
  for (const pack of data ?? []) {
    if (!grouped[pack.industry]) grouped[pack.industry] = [];
    grouped[pack.industry].push(pack);
  }
  return grouped;
}

export async function getGlobalTheme(): Promise<GlobalTheme | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("global_theme")
    .select("tokens")
    .single();
  return (data?.tokens as GlobalTheme) ?? null;
}

export type ProjectBrain = {
  project: {
    id: string;
    name: string;
    type: string;
    industry: string;
    app_type: string;
    description: string;
    complexity: string;
    features: string[];
    primary_action: string;
    target_user: string;
    platform: string[];
    core_features: string;
    notes?: string;
    created_at: string;
    updated_at: string;
  };
  design_tokens: {
    colors: Record<string, string>;
    typography: {
      heading_font: string;
      body_font: string;
      scale: Record<string, string>;
      weights: Record<string, string>;
      line_heights: Record<string, string>;
    };
    spacing: {
      base: string;
      scale: Record<string, string>;
      screen_padding: string;
      card_padding: string;
    };
    radius: Record<string, string>;
    shadows: {
      sm: string;
      md: string;
      lg: string;
    };
  };
  icons: {
    library: string;
    weight: string;
    fill: number;
    industry_set: string;
    primary_icons: string[];
    navigation_icons: string[];
    action_icons: string[];
    fallback: string;
  };
  style_pack: {
    name: string;
    aesthetic: string;
    tone: string;
    motion: string;
  };
  components: {
    button: { primary: string; secondary: string; height: string; font_weight: string };
    card: { style: string; image_ratio: string; padding: string };
    input: { style: string; height: string };
    nav: { type: string; items: number; style: string };
    header: { style: string; height: string };
    badge: { style: string };
    modal: { mobile: string; tablet: string };
  };
  scaling: {
    base_device: string;
    breakpoints: Record<string, string>;
    nav_shift_at: string;
    layout_shift_at: string;
    touch_target_min: string;
    grid_base: string;
    safe_areas: Record<string, string>;
  };
  screens: {
    inventory: string[];
    navigation_flow: Record<string, string[]>;
    tab_bar: string[];
  };
  animations: {
    default_duration: string;
    easing: string;
    screen_transition: string;
    entrance: string;
    exit: string;
    press_state: string;
    loading: string;
    stagger_delay: string;
  };
  capsules: {
    animate: boolean;
    dark_mode: boolean;
    glass: boolean;
    wireframe: boolean;
  };
  custom_additions: string[];
  global_theme: GlobalTheme | null;
  prompt_context: {
    system_summary: string;
    last_prompt: string | null;
    session_count: number;
  };
  versions: {
    current: number;
    history: Array<{
      version: number;
      timestamp: string;
      prompt: string;
      screens_affected: string[];
    }>;
  };
  org: {
    org_id: string | null;
    plan: string;
    credits_remaining: number;
    credits_total: number;
    credits_reset: string;
  };
  meta: {
    brain_version: string;
    created_at: string;
    updated_at: string;
    total_prompts: number;
    total_screens_generated: number;
  };
  _inputs: {
    // Screen 1 inputs
    project_name: string;
    description: string;
    industry: string;
    app_type: string;
    project_type: string;
    complexity: string;
    features: string[];
    // Screen 2 inputs
    style_pack: string;
    font_pairing: string;
    screenshots: string[];
    inspiration_images: string[];
    reference_urls: string[];
  };
};

export type Project = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  project_type: "existing_app" | "new_idea" | null;
  app_type: string | null;
  industry: string | null;
  primary_action: string | null;
  target_user: string | null;
  platform: string[] | null;
  core_features: string | null;
  setup_notes: string | null;
  complexity: string | null;
  features: string[] | null;
  setup_complete: boolean;
  style_pack: string | null;
  font_pairing: string | null;
  inspiration_images: string[] | null;
  reference_urls: string[] | null;
  brain: ProjectBrain | null;
  created_at: string;
  updated_at: string;
};

export type ProjectSetupStep1 = {
  name: string;
  description: string;
  project_type: "existing_app" | "new_idea";
  app_type: string;
  industry: string;
  complexity: string;
  features: string[];
  setup_notes?: string;
};

export type DBMessage = {
  id: string;
  project_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  images: { mimeType: string }[] | null;
  created_at: string;
};

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function getProjects(userId: string): Promise<Project[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createProject(
  userId: string,
  name: string,
  description?: string
): Promise<Project> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: userId, name, description: description ?? null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createProjectWithSetup(
  userId: string,
  setup: ProjectSetupStep1
): Promise<Project> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      name: setup.name,
      description: setup.description,
      project_type: setup.project_type,
      app_type: setup.app_type,
      industry: setup.industry,
      complexity: setup.complexity,
      features: setup.features,
      setup_notes: setup.setup_notes ?? null,
      setup_complete: false,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function completeProjectSetup(projectId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("projects")
    .update({ setup_complete: true, updated_at: new Date().toISOString() })
    .eq("id", projectId);
  if (error) throw error;
}

export type VisualDirectionData = {
  style_pack: string;
  font_pairing: string;
  inspiration_images: string[];
  reference_urls: string[];
  brain: ProjectBrain;
};

export async function saveVisualDirection(
  projectId: string,
  data: VisualDirectionData
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      style_pack: data.style_pack,
      font_pairing: data.font_pairing,
      inspiration_images: data.inspiration_images,
      reference_urls: data.reference_urls,
      brain: data.brain,
      setup_complete: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);
  if (error) throw error;
}

export async function getProject(projectId: string): Promise<Project | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();
  if (error) return null;
  return data;
}

export async function updateProject(
  projectId: string,
  fields: { name?: string; description?: string }
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("projects")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", projectId);
  if (error) throw error;
}

export async function deleteProject(projectId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw error;
}

// ─── Messages (per project) ───────────────────────────────────────────────────

export async function deleteMessages(projectId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("project_id", projectId);
  if (error) throw error;
}

export async function getMessages(projectId: string): Promise<DBMessage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function saveMessage(
  projectId: string,
  userId: string,
  role: "user" | "assistant",
  content: string,
  imageTypes?: string[]
): Promise<DBMessage> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      project_id: projectId,
      user_id: userId,
      role,
      content,
      images: imageTypes ? imageTypes.map((t) => ({ mimeType: t })) : null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Project Files (single storage model) ────────────────────────────────────

export type ProjectFile = {
  id: string;
  project_id: string;
  user_id: string;
  file_path: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export async function getProjectFiles(projectId: string): Promise<ProjectFile[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", projectId)
    .order("file_path", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function upsertProjectFile(
  projectId: string,
  userId: string,
  filePath: string,
  content: string
): Promise<ProjectFile> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_files")
    .upsert(
      {
        project_id: projectId,
        user_id: userId,
        file_path: filePath,
        content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,file_path" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProjectFiles(projectId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("project_files")
    .delete()
    .eq("project_id", projectId);
  if (error) throw error;
}

// ─── Token Usage ─────────────────────────────────────────────────────────────

export type TokenUsage = {
  id: string;
  project_id: string;
  user_id: string;
  endpoint: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  created_at: string;
};

export type TokenSummary = {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  requests: number;
};

export async function saveTokenUsage(
  projectId: string,
  userId: string,
  endpoint: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("token_usage").insert({
    project_id: projectId,
    user_id: userId,
    endpoint,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  });
  if (error) console.error("[saveTokenUsage]", error);
}

export async function getProjectTokenSummary(
  projectId: string
): Promise<TokenSummary> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("token_usage")
    .select("input_tokens, output_tokens")
    .eq("project_id", projectId);
  if (error || !data) return { input_tokens: 0, output_tokens: 0, total_tokens: 0, requests: 0 };
  return {
    input_tokens:  data.reduce((s, r) => s + r.input_tokens,  0),
    output_tokens: data.reduce((s, r) => s + r.output_tokens, 0),
    total_tokens:  data.reduce((s, r) => s + r.input_tokens + r.output_tokens, 0),
    requests: data.length,
  };
}

export async function getUserTokenSummary(
  userId: string
): Promise<TokenSummary> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("token_usage")
    .select("input_tokens, output_tokens")
    .eq("user_id", userId);
  if (error || !data) return { input_tokens: 0, output_tokens: 0, total_tokens: 0, requests: 0 };
  return {
    input_tokens:  data.reduce((s, r) => s + r.input_tokens,  0),
    output_tokens: data.reduce((s, r) => s + r.output_tokens, 0),
    total_tokens:  data.reduce((s, r) => s + r.input_tokens + r.output_tokens, 0),
    requests: data.length,
  };
}

// ─── Industries ───────────────────────────────────────────────────────────────

export type Industry = {
  id: string;
  slug: string;
  name: string;
  valid_app_types: string[];
  brain: Record<string, unknown>;
  sort_order: number;
  created_at: string;
};

export async function getIndustries(): Promise<Industry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("industries")
    .select("id, slug, name, valid_app_types, sort_order, created_at")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Industry[];
}

export async function getIndustry(slug: string): Promise<Industry | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("industries")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error) return null;
  return data as Industry;
}

/** Fetch full industry record (including brain JSON) by industry name. */
export async function getIndustryByName(name: string): Promise<Industry | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("industries")
    .select("*")
    .eq("name", name)
    .maybeSingle();
  if (error) return null;
  return data as Industry | null;
}

/** Fetch full product record (including brain JSON) by product name (archetype_name). */
export async function getProductByName(name: string): Promise<Product | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("name", name)
    .maybeSingle();
  if (error) return null;
  return data as Product | null;
}

// ─── Products (archetypes / app types) ────────────────────────────────────────

export type Product = {
  id: string;
  archetype_id: string;
  name: string;
  description: string | null;
  valid_industries: string[];
  brain: Record<string, unknown>;
  sort_order: number;
  created_at: string;
};

export async function getProducts(): Promise<Product[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, archetype_id, name, description, valid_industries, sort_order, created_at")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Product[];
}

export async function getProductsForIndustry(industryName: string): Promise<Product[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, archetype_id, name, description, valid_industries, sort_order, created_at")
    .contains("valid_industries", [industryName])
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Product[];
}

// ─── Features (optional capability chips in the new-project flow) ─────────────

export type Feature = {
  id: string;
  feature_id: string;
  label: string;
  description: string | null;
  icon: string | null;
  /** Empty = universal (shown for all products). Non-empty = archetype-specific. */
  archetypes: string[];
  brain: Record<string, unknown>;
  sort_order: number;
  created_at: string;
};

/** All features ordered by sort_order. */
export async function getFeatures(): Promise<Feature[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("features")
    .select("id, feature_id, label, description, icon, archetypes, brain, sort_order, created_at")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Feature[];
}

/**
 * Features relevant to a given archetype_id.
 * Returns universal features (archetypes = []) plus those that include the given archetype.
 */
export async function getFeaturesForArchetype(archetypeId: string): Promise<Feature[]> {
  const all = await getFeatures();
  return all.filter(
    (f) => f.archetypes.length === 0 || f.archetypes.includes(archetypeId)
  );
}

// ─── Project Collaborators ────────────────────────────────────────────────────

export type CollaboratorRole = "owner" | "editor" | "viewer";

export type ProjectCollaborator = {
  id: string;
  project_id: string;
  user_id: string;
  role: CollaboratorRole;
  invited_by: string | null;
  created_at: string;
  email?: string;
  display_name?: string;
  avatar_url?: string;
};

export type ProjectInvitation = {
  id: string;
  project_id: string;
  email: string;
  role: "editor" | "viewer";
  invited_by: string;
  status: "pending" | "accepted";
  created_at: string;
};
