import { createClient } from "@/lib/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export type Project = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type ChatSession = {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type DBMessage = {
  id: string;
  session_id: string;
  project_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  images: { mimeType: string }[] | null;
  created_at: string;
};

export type DBArtifact = {
  id: string;
  session_id: string;
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

// ─── Chat Sessions ────────────────────────────────────────────────────────────

export async function getChatSessions(projectId: string): Promise<ChatSession[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createChatSession(
  projectId: string,
  userId: string,
  title = "New Chat"
): Promise<ChatSession> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({ project_id: projectId, user_id: userId, title })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateChatSessionTitle(
  sessionId: string,
  title: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("chat_sessions")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) throw error;
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("chat_sessions")
    .delete()
    .eq("id", sessionId);
  if (error) throw error;
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function getMessages(sessionId: string): Promise<DBMessage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function saveMessage(
  sessionId: string,
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
      session_id: sessionId,
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

// ─── Artifacts ────────────────────────────────────────────────────────────────

export async function saveArtifacts(
  artifacts: Array<{ title: string; language: string; content: string }>,
  sessionId: string,
  projectId: string,
  userId: string,
  messageId: string
): Promise<void> {
  if (!artifacts.length) return;
  const supabase = createClient();
  const { error } = await supabase.from("artifacts").insert(
    artifacts.map((a) => ({
      session_id: sessionId,
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

export async function getArtifacts(sessionId: string): Promise<DBArtifact[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("artifacts")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
