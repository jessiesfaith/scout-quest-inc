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
  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/" ||
    path.startsWith("/auth") ||
    path.startsWith("/legal") ||
    path.startsWith("/reset-password");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Signed-in users go to the app, not the marketing page.
  if (user && path === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets (including
    // public/ scripts like login-wire.js).
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|txt|map)$).*)",
  ],
};
