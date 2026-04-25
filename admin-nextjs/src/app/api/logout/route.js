import { NextResponse } from "next/server";
import { getCookieName } from "@/lib/auth";

export async function GET(request) {
  const url = request.nextUrl.clone();
  const basePath = request.nextUrl.basePath || "";
  url.pathname = `${basePath}/login`;
  const res = NextResponse.redirect(url);
  res.cookies.set(getCookieName(), "", { httpOnly: true, path: basePath || "/", maxAge: 0 });
  return res;
}
