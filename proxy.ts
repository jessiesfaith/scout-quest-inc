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

  // Public: the landing page (with its sign-in card), account creation,
  // legal documents, and auth endpoints.
  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/" ||
    path.startsWith("/auth") ||
    path.startsWith("/signup") ||
    path.startsWith("/legal");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Signed-in users don't need the landing page or signup — and submitting
  // signup while signed in would silently swap their session.
  if (user && (path === "/" || path.startsWith("/signup"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
