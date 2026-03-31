import { NextResponse } from "next/server";
import { getCookieName, verifyAdminToken } from "@/lib/auth";

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/login") ||
    pathname.startsWith("/api/logout") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico")
  ) {
    return NextResponse.next();
  }

  if (!pathname.startsWith("/dashboard") && !pathname.startsWith("/conversations") && !pathname.startsWith("/api/admin")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(getCookieName())?.value;
  const verified = await verifyAdminToken(token);
  if (!verified.ok) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/conversations/:path*", "/api/admin/:path*", "/"],
};
