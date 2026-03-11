import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  // Verify the caller is an authenticated admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { email, role = "member", access = "read" } = body as {
    email: string;
    role: "admin" | "member";
    access: "read" | "write";
  };

  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const admin = createAdminClient();

  // Upsert invitation record first (so the DB trigger can read it on signup)
  const { error: inviteDbError } = await admin
    .from("invitations")
    .upsert(
      { email, role, access, invited_by: user.id, status: "pending" },
      { onConflict: "email,status" }
    );
  if (inviteDbError) {
    return NextResponse.json({ error: inviteDbError.message }, { status: 500 });
  }

  // Send the invite email via Supabase Auth (creates user if needed, sends magic-link invite)
  const redirectTo = `${new URL(req.url).origin}/auth/callback`;
  const { error: authError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });

  if (authError) {
    // If user already exists Supabase returns an error — that's ok, invitation is stored
    // Only surface unexpected errors
    if (!authError.message.toLowerCase().includes("already")) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
