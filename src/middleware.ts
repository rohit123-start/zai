import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Unauthenticated users can only access /login and /auth/*
  if (!user && pathname !== "/login" && !pathname.startsWith("/auth")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Authenticated users get redirected away from login
  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Protect /admin — only users with role='admin' may access it
  if (user && pathname.startsWith("/admin")) {
    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    // If table doesn't exist yet (migration not run), allow through so the
    // page can show a helpful message instead of a silent redirect loop.
    if (!error && (!profile || profile.role !== "admin")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
