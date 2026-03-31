import { NextResponse } from "next/server";

export async function POST(request, { params }) {
  const resolvedParams = await params;
  const id = Number(resolvedParams?.id);
  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ ok: false, error: "invalid_conversation_id" }, { status: 400 });
  }

  const backend = (process.env.BACKEND_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
  const token = process.env.ADMIN_API_TOKEN || "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "ADMIN_API_TOKEN_not_set" }, { status: 500 });
  }

  const res = await fetch(`${backend}/admin/conversations/${id}/end-handoff`, {
    method: "POST",
    headers: { "x-admin-token": token },
  }).catch(() => null);

  if (!res) return NextResponse.json({ ok: false, error: "backend_unreachable" }, { status: 502 });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return NextResponse.json(data, { status: res.status });
}

