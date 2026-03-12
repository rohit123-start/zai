import { createClient } from "@/lib/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export type DesignGuideline = {
  id: string;
  project_id: string;
  user_id: string;
  dg: string;
  created_at: string;
  updated_at: string;
};

export type Project = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
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

export type DBArtifact = {
  id: string;
  project_id: string;
  user_id: string;
  message_id: string | null;
  title: string;
  language: string;
  content: string;
  created_at: string;
  updated_at: string;
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

// ─── Artifacts (per project) ──────────────────────────────────────────────────

export async function saveArtifacts(
  artifacts: Array<{ title: string; language: string; content: string }>,
  projectId: string,
  userId: string,
  messageId: string
): Promise<void> {
  if (!artifacts.length) return;
  const supabase = createClient();
  const { error } = await supabase.from("artifacts").insert(
    artifacts.map((a) => ({
      project_id: projectId,
      user_id: userId,
      message_id: messageId,
      title: a.title,
      language: a.language,
      content: a.content,
    }))
  );
  if (error) throw error;
}

export async function getArtifacts(projectId: string): Promise<DBArtifact[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("artifacts")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// ─── Project Pages (multi-page preview, one per page per project) ────────────

export type ProjectPage = {
  id: string;
  project_id: string;
  user_id: string;
  page_name: string;
  html_content: string;
  created_at: string;
  updated_at: string;
};

export async function getProjectPages(projectId: string): Promise<ProjectPage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_pages")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function deleteProjectPages(projectId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("project_pages")
    .delete()
    .eq("project_id", projectId);
  if (error) throw error;
}

export async function upsertProjectPage(
  projectId: string,
  userId: string,
  pageName: string,
  htmlContent: string
): Promise<ProjectPage> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_pages")
    .upsert(
      {
        project_id: projectId,
        user_id: userId,
        page_name: pageName,
        html_content: htmlContent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,page_name" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Project Files (file-based multi-page system) ────────────────────────────

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

// ─── Design Guidelines (one per project) ─────────────────────────────────────

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

// ─── Design Guidelines (one per project) ─────────────────────────────────────

export async function getDesignGuideline(
  projectId: string
): Promise<DesignGuideline | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("design_guidelines")
    .select("id, project_id, user_id, compressed_dg, created_at, updated_at")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, dg: data.compressed_dg } as DesignGuideline;
}
