import { NextResponse } from "next/server";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const conversationId = Number(body?.conversation_id);
  const message = String(body?.message || "").trim();
  const agentName = String(body?.agent_name || "").trim() || "Admin";

  if (!conversationId || Number.isNaN(conversationId) || !message) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const backend = (process.env.BACKEND_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
  const token = process.env.ADMIN_API_TOKEN || "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "ADMIN_API_TOKEN_not_set" }, { status: 500 });
  }

  const res = await fetch(`${backend}/admin/agent/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": token },
    body: JSON.stringify({ conversation_id: conversationId, message, agent_name: agentName }),
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

