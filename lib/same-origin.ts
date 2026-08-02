// Route handlers that mutate state must only accept same-origin requests.
// Server Actions get this check from Next automatically; hand-written POST
// handlers do not. Without it, any page on the internet can POST here with
// the visitor's cookies — planting a session, spamming the request queue,
// or firing reset mail.
//
// Two gates: the browser-set Origin/Sec-Fetch-Site headers, and a real JSON
// content type (a cross-site <form> can only send text/plain, multipart, or
// urlencoded — never application/json — so requiring JSON alone blocks the
// simple-request forms that dodge CORS preflight).
export function isSameOrigin(request: Request): boolean {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) return false;

  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) return false;
    } catch {
      return false;
    }
  } else if (!site) {
    // Neither header present — not a normal browser fetch from our page.
    return false;
  }

  return true;
}
