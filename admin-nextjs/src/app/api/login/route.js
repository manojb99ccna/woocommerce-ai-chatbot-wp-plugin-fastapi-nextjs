import { NextResponse } from "next/server";
import { getCookieName, signAdminToken } from "@/lib/auth";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const username = String(body?.username || "");
  const password = String(body?.password || "");

  const expectedUser = process.env.ADMIN_USERNAME || "";
  const expectedPass = process.env.ADMIN_PASSWORD || "";
  if (!expectedUser || !expectedPass) {
    return NextResponse.json({ ok: false, error: "admin_credentials_not_set" }, { status: 500 });
  }

  if (username !== expectedUser || password !== expectedPass) {
    return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
  }

  const token = await signAdminToken({ username, expiresInSeconds: 60 * 60 * 24 * 7 });
  const res = NextResponse.json({ ok: true });
  const basePath = request.nextUrl?.basePath || "";
  res.cookies.set(getCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: basePath || "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
