import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && sessionData?.user) {
      const user = sessionData.user;

      // Accept any pending project invitations for this email
      await acceptPendingInvitations(user.id, user.email ?? "");

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}

async function acceptPendingInvitations(userId: string, email: string) {
  if (!email) return;

  const admin = createAdminClient();

  // Find all pending invites for this email
  const { data: invites, error: fetchErr } = await admin
    .from("project_invitations")
    .select("id, project_id, role, invited_by")
    .eq("email", email.toLowerCase())
    .eq("status", "pending");

  if (fetchErr || !invites || invites.length === 0) return;

  for (const invite of invites) {
    // Add to project_collaborators
    await admin.from("project_collaborators").upsert(
      {
        project_id: invite.project_id,
        user_id: userId,
        role: invite.role,
        invited_by: invite.invited_by,
      },
      { onConflict: "project_id,user_id" }
    );

    // Mark invite as accepted
    await admin
      .from("project_invitations")
      .update({ status: "accepted" })
      .eq("id", invite.id);
  }
}
