import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/admin/users — returns all user_profiles + pending invitations
export async function GET() {
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

  const admin = createAdminClient();

  const [usersRes, invitesRes] = await Promise.all([
    admin.from("user_profiles").select("*").order("created_at", { ascending: true }),
    admin
      .from("invitations")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  if (usersRes.error) return NextResponse.json({ error: usersRes.error.message }, { status: 500 });

  return NextResponse.json({
    users: usersRes.data ?? [],
    pendingInvites: invitesRes.data ?? [],
  });
}
