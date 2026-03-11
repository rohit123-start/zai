import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ id: string }> };

async function getCallerRole(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("user_profiles")
    .select("role, user_id")
    .eq("user_id", user.id)
    .single();
  return data;
}

// PATCH /api/admin/users/[id] — update role and/or access
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const caller = await getCallerRole(supabase);
  if (!caller || caller.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as { role?: string; access?: string };
  const update: Record<string, string> = {};
  if (body.role) update.role = body.role;
  if (body.access) update.access = body.access;
  if (!Object.keys(update).length) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("user_profiles").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/users/[id] — remove user profile (and optionally auth user)
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const caller = await getCallerRole(supabase);
  if (!caller || caller.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  // Get the user_id before deleting the profile
  const { data: target } = await admin
    .from("user_profiles")
    .select("user_id")
    .eq("id", id)
    .single();

  // Prevent admin from deleting their own account
  if (target?.user_id === caller.user_id) {
    return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
  }

  // Delete the auth user — this cascades to user_profiles via FK
  if (target?.user_id) {
    await admin.auth.admin.deleteUser(target.user_id);
  } else {
    await admin.from("user_profiles").delete().eq("id", id);
  }

  return NextResponse.json({ ok: true });
}
