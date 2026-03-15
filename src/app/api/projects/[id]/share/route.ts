import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function getCallerAndProject(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 as const };

  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id, name, created_at")
    .eq("id", projectId)
    .single();

  if (!project) return { error: "Project not found", status: 404 as const };
  if (project.user_id !== user.id) return { error: "Forbidden", status: 403 as const };

  return { user, project };
}

// GET /api/projects/[id]/share
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await getCallerAndProject(id);
  if ("error" in result)
    return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, project } = result;

  const admin = createAdminClient();

  const [{ data: collabs }, { data: invites }] = await Promise.all([
    admin
      .from("project_collaborators")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at"),
    admin
      .from("project_invitations")
      .select("*")
      .eq("project_id", project.id)
      .eq("status", "pending")
      .order("created_at"),
  ]);

  // Enrich collaborators with auth user info
  const enriched = await Promise.all(
    (collabs ?? []).map(async (c) => {
      try {
        const { data } = await admin.auth.admin.getUserById(c.user_id);
        return {
          ...c,
          email: data.user?.email ?? "",
          display_name: data.user?.user_metadata?.full_name ?? data.user?.email ?? "",
          avatar_url: data.user?.user_metadata?.avatar_url ?? null,
        };
      } catch {
        return { ...c, email: "", display_name: "", avatar_url: null };
      }
    })
  );

  // Owner entry
  const { data: ownerAuth } = await admin.auth.admin.getUserById(user.id);
  const owner = {
    id: "owner",
    project_id: project.id,
    user_id: user.id,
    role: "owner" as const,
    invited_by: null,
    created_at: project.created_at ?? new Date().toISOString(),
    email: ownerAuth.user?.email ?? "",
    display_name: ownerAuth.user?.user_metadata?.full_name ?? ownerAuth.user?.email ?? "",
    avatar_url: ownerAuth.user?.user_metadata?.avatar_url ?? null,
  };

  return NextResponse.json({
    collaborators: [owner, ...enriched.filter((c) => c.user_id !== user.id)],
    invitations: invites ?? [],
  });
}

// POST /api/projects/[id]/share — invite by email
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // Derive the app origin from the request itself so we never rely on a missing env var
  const reqOrigin = new URL(req.url).origin;
  const result = await getCallerAndProject(id);
  if ("error" in result)
    return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, project } = result;

  const body = await req.json().catch(() => ({}));
  const { email, role = "editor" } = body as { email?: string; role?: string };

  if (!email?.trim())
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  if (!["editor", "viewer"].includes(role))
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });

  const trimmedEmail = email.trim().toLowerCase();
  const admin = createAdminClient();

  // Don't let owner invite themselves
  const { data: ownerAuth } = await admin.auth.admin.getUserById(user.id);
  if (ownerAuth.user?.email?.toLowerCase() === trimmedEmail)
    return NextResponse.json({ error: "You can't invite yourself" }, { status: 400 });

  // Check for a duplicate pending invite
  const { data: existingPendingInvite } = await admin
    .from("project_invitations")
    .select("id")
    .eq("project_id", project.id)
    .eq("email", trimmedEmail)
    .eq("status", "pending")
    .maybeSingle();

  if (existingPendingInvite)
    return NextResponse.json(
      { error: "An invite has already been sent to this email" },
      { status: 409 }
    );

  // Check if the person is already an active collaborator (they signed up before)
  const { data: usersPage } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const inviteeUser = usersPage?.users?.find(
    (u) => u.email?.toLowerCase() === trimmedEmail
  );
  if (inviteeUser) {
    const { data: existingCollab } = await admin
      .from("project_collaborators")
      .select("id")
      .eq("project_id", project.id)
      .eq("user_id", inviteeUser.id)
      .maybeSingle();
    if (existingCollab)
      return NextResponse.json(
        { error: "This person is already a collaborator on this project" },
        { status: 409 }
      );
  }

  // Upsert invite record — handles the case where a prior accepted row exists
  const { data: invite, error: inviteErr } = await admin
    .from("project_invitations")
    .upsert(
      {
        project_id: project.id,
        email: trimmedEmail,
        role,
        invited_by: user.id,
        status: "pending",
      },
      { onConflict: "project_id,email" }
    )
    .select()
    .single();

  if (inviteErr)
    return NextResponse.json({ error: inviteErr.message }, { status: 500 });

  // Build the redirect URL.
  // Must go through /auth/callback so PKCE code can be exchanged;
  // next= tells the callback where to land after accepting.
  // Use NEXT_PUBLIC_APP_URL if set, otherwise fall back to the request origin.
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? reqOrigin).replace(/\/$/, "");
  const redirectTo = `${appUrl}/auth/callback?next=/projects/${project.id}`;

  // Step 1 — try the standard invite (only works for brand-new Supabase users)
  const { error: emailErr } = await admin.auth.admin.inviteUserByEmail(trimmedEmail, {
    redirectTo,
    data: {
      invited_to_project: project.id,
      project_name: project.name,
      project_role: role,
    },
  });

  if (emailErr) {
    const isAlreadyRegistered =
      emailErr.message.toLowerCase().includes("already") ||
      emailErr.message.toLowerCase().includes("registered");

    if (isAlreadyRegistered) {
      // Step 2 — user already has an account: send a magic-link sign-in email.
      // After clicking, the auth callback will detect the pending invite and
      // add them to project_collaborators, then redirect to the project.
      const anonClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { error: otpErr } = await anonClient.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: redirectTo,
        },
      });
      if (otpErr) {
        console.warn("[project invite] OTP fallback error:", otpErr.message);
      }
    } else {
      console.warn("[project invite] email error:", emailErr.message);
    }
  }

  return NextResponse.json({ invitation: invite });
}
