import { NextResponse } from "next/server";
import { getCookieName } from "@/lib/auth";

export async function GET(request) {
  const url = new URL("/login", request.url);
  const res = NextResponse.redirect(url);
  res.cookies.set(getCookieName(), "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}

