import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Next 16 proxy (successor to middleware): refreshes the Supabase session cookie
// and redirects unauthenticated users to the landing page ("/"), which hosts
// the sign-in form.
export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getUser() — the session
  // refresh happens inside getUser and must see the original cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public: the marketing site (Jessica's index.html served at "/"),
  // legal documents, auth endpoints, and the password-reset landing.
  //
  // /api/ingest is not public — it is machine-to-machine, and it does its
  // own bearer-token check. It has to be excluded here because redirecting
  // it turns "your token is wrong" into a 307 to an HTML page, which a
  // script reads as a confusing success. Nothing is loosened by this: the
  // route rejects every request that does not carry the token, and it
  // never reads a cookie, so a browser session grants nothing there.
  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/" ||
    path.startsWith("/auth") ||
    path.startsWith("/legal") ||
    path.startsWith("/reset-password") ||
    path === "/api/ingest";

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // "/" always serves the marketing site, signed in or not — the sidebar
  // brand links back to it, and sign-in navigates to /dashboard itself.

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets (including
    // public/ scripts like login-wire.js).
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|txt|map)$).*)",
  ],
};
