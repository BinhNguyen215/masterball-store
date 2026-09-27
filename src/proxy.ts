import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SESSION_COOKIE_NAMES = [
  "masterball-admin.session_token",
  "__Secure-masterball-admin.session_token",
];

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  if (
    request.nextUrl.pathname.startsWith("/admin") &&
    request.nextUrl.pathname !== "/admin/login" &&
    !SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name))
  ) {
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

// Only `/admin` needs the proxy: the security headers are also set by
// `next.config.ts` `headers()` for `/(.*)`, and every API route authorizes
// itself. Matching `/api/:path*` would make Next buffer each request body
// (default 10 MB, silently truncated) on top of the app's own multipart ceiling.
export const config = {
  matcher: ["/admin/:path*"],
};
