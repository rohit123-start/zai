import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// DELETE — cancel pending invite
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; inviteId: string }> }
) {
  const { id, inviteId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("user_id")
    .eq("id", id)
    .single();

  if (!project || project.user_id !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabase
    .from("project_invitations")
    .delete()
    .eq("id", inviteId)
    .eq("project_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
