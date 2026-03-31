import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const resolvedParams = await params;
  const id = Number(resolvedParams?.id);
  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ error: "invalid_conversation_id" }, { status: 400 });
  }

  const backend = (process.env.BACKEND_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
  const token = process.env.ADMIN_API_TOKEN || "";
  if (!token) {
    return NextResponse.json({ error: "ADMIN_API_TOKEN_not_set" }, { status: 500 });
  }

  const afterId = request.nextUrl.searchParams.get("after_id") || "0";
  const url = `${backend}/admin/conversations/${id}/messages?after_id=${encodeURIComponent(afterId)}`;

  const res = await fetch(url, { headers: { "x-admin-token": token }, cache: "no-store" }).catch(() => null);
  if (!res) return NextResponse.json({ error: "backend_unreachable" }, { status: 502 });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return NextResponse.json(data, { status: res.status });
}
