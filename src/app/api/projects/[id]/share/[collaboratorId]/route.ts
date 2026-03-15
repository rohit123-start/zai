import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function getCallerAndProject(projectId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 as const };
  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .single();
  if (!project) return { error: "Project not found", status: 404 as const };
  if (project.user_id !== user.id) return { error: "Forbidden", status: 403 as const };
  return { user, project };
}

// PATCH — change collaborator role
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; collaboratorId: string }> }
) {
  const { id, collaboratorId } = await params;
  const result = await getCallerAndProject(id);
  if ("error" in result)
    return NextResponse.json({ error: result.error }, { status: result.status });

  const { role } = await req.json();
  if (!["editor", "viewer"].includes(role))
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase
    .from("project_collaborators")
    .update({ role })
    .eq("id", collaboratorId)
    .eq("project_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE — remove collaborator (and reset their invite so they can be re-invited)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; collaboratorId: string }> }
) {
  const { id, collaboratorId } = await params;
  const result = await getCallerAndProject(id);
  if ("error" in result)
    return NextResponse.json({ error: result.error }, { status: result.status });

  const supabase = await createClient();
  const admin = createAdminClient();

  // Fetch the collaborator row so we know their user_id → email
  const { data: collab } = await supabase
    .from("project_collaborators")
    .select("user_id")
    .eq("id", collaboratorId)
    .eq("project_id", id)
    .single();

  // Remove from project_collaborators
  const { error } = await supabase
    .from("project_collaborators")
    .delete()
    .eq("id", collaboratorId)
    .eq("project_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Delete the corresponding project_invitations row (by email lookup) so the
  // owner can re-invite them cleanly — the upsert will create a fresh record.
  if (collab?.user_id) {
    const { data: authUser } = await admin.auth.admin.getUserById(collab.user_id);
    const email = authUser.user?.email?.toLowerCase();
    if (email) {
      await admin
        .from("project_invitations")
        .delete()
        .eq("project_id", id)
        .eq("email", email);
    }
  }

  return NextResponse.json({ ok: true });
}
