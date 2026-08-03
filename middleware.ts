import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY, AUTH_ENFORCED } from "@/lib/supabaseConfig";

// Two jobs, in this order:
//
// 1. REFRESH THE SESSION on every request. Supabase access tokens are short-lived; without
//    a refresh here the cookies go stale and server components start seeing a signed-out
//    user mid-session. This runs whether or not auth is enforced — it must never be skipped.
// 2. GATE ROUTES, but only when `AUTH_ENFORCED` is on (see lib/supabaseConfig.ts for why
//    it defaults off).
//
// The gate is a redirect, not security. Anyone can call the database directly with the
// public anon key, so the real boundary is RLS — this only keeps the UI honest.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Must be getUser(), not getSession(): it revalidates the token server-side. It also
  // triggers the refresh that writes the cookies above.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/login";

  if (AUTH_ENFORCED && !user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Remember where they were headed so sign-in lands them there, not on the dashboard.
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // Already signed in → /login is a dead end. Send them into the app.
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Everything except Next's own assets and static files — those don't need a session and
  // running middleware on them is pure latency.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
