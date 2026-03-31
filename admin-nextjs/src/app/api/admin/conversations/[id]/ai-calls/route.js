import { NextResponse } from "next/server";
import { query, table } from "@/lib/db";

export async function GET(request, { params }) {
  const resolvedParams = await params;
  const id = Number(resolvedParams?.id);
  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ error: "invalid_conversation_id" }, { status: 400 });
  }

  const afterIdRaw = request.nextUrl.searchParams.get("after_id") || "0";
  const afterId = Number(afterIdRaw) || 0;

  const calls = table("openai_calls");
  const sql = `
    SELECT id, created_at, trigger_message_id, ok, model, latency_ms, error_type, error_message, response_json
    FROM ${calls}
    WHERE conversation_id = ? AND id > ?
    ORDER BY id ASC
    LIMIT 200
  `;

  const rows = await query(sql, [id, afterId]);
  const items = Array.isArray(rows) ? rows : [];
  const out = items.map((r) => ({
    id: Number(r.id || 0),
    created_at: r.created_at ? new Date(r.created_at).toISOString() : "",
    trigger_message_id: r.trigger_message_id ? Number(r.trigger_message_id) : null,
    ok: Boolean(r.ok),
    model: r.model || null,
    latency_ms: r.latency_ms ? Number(r.latency_ms) : null,
    error_type: r.error_type || null,
    error_message: r.error_message || null,
    response_json: r.response_json || null,
  }));

  return NextResponse.json({ conversation_id: id, calls: out });
}

