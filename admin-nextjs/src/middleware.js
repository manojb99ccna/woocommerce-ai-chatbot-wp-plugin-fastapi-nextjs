import { NextResponse } from "next/server";
import { getCookieName, verifyAdminToken } from "@/lib/auth";

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const basePath = request.nextUrl.basePath || "";
  const withBasePath = (p) => `${basePath}${p}`;

  if (
    pathname.startsWith(withBasePath("/login")) ||
    pathname.startsWith(withBasePath("/api/login")) ||
    pathname.startsWith(withBasePath("/api/logout")) ||
    pathname.startsWith(withBasePath("/_next")) ||
    pathname === withBasePath("/favicon.ico")
  ) {
    return NextResponse.next();
  }

  if (
    !pathname.startsWith(withBasePath("/dashboard")) &&
    !pathname.startsWith(withBasePath("/conversations")) &&
    !pathname.startsWith(withBasePath("/api/admin"))
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(getCookieName())?.value;
  const verified = await verifyAdminToken(token);
  if (!verified.ok) {
    const url = request.nextUrl.clone();
    url.pathname = withBasePath("/login");
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
