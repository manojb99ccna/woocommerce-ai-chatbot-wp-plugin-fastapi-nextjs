"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";

function normalizeRole(role) {
  if (role === "agent") return "agent";
  if (role === "assistant") return "assistant";
  return "user";
}

function buildAiByTriggerId(calls) {
  const out = {};
  if (!Array.isArray(calls)) return out;
  for (let i = 0; i < calls.length; i++) {
    const c = calls[i];
    const t = Number(c?.trigger_message_id || 0);
    const id = Number(c?.id || 0);
    if (!t || !id) continue;
    const existing = out[String(t)];
    if (!existing || Number(existing.id || 0) < id) out[String(t)] = c;
  }
  return out;
}

function parseMeta(metaJson) {
  if (!metaJson) return null;
  if (typeof metaJson === "object") return metaJson;
  if (typeof metaJson !== "string") return null;
  try {
    return JSON.parse(metaJson);
  } catch {
    return null;
  }
}

function prettyTextOrJson(text) {
  if (!text) return "";
  if (typeof text === "object") {
    try {
      return JSON.stringify(text, null, 2);
    } catch {
      return String(text);
    }
  }
  if (typeof text !== "string") return String(text);
  const trimmed = text.trim();
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      const obj = JSON.parse(trimmed);
      return JSON.stringify(obj, null, 2);
    } catch {}
  }
  return text;
}

export default function ConversationChatClient({ conversationId, initialMessages, initialAiCalls, canSend = false }) {
  const [messages, setMessages] = useState(Array.isArray(initialMessages) ? initialMessages : []);
  const [aiCalls, setAiCalls] = useState(Array.isArray(initialAiCalls) ? initialAiCalls : []);
  const [aiByTriggerId, setAiByTriggerId] = useState(() => buildAiByTriggerId(initialAiCalls));
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");

  const lastId = useMemo(() => {
    let max = 0;
    for (let i = 0; i < messages.length; i++) {
      const id = Number(messages[i]?.id || 0);
      if (id > max) max = id;
    }
    return max;
  }, [messages]);

  const lastAiId = useMemo(() => {
    let max = 0;
    for (let i = 0; i < aiCalls.length; i++) {
      const id = Number(aiCalls[i]?.id || 0);
      if (id > max) max = id;
    }
    return max;
  }, [aiCalls]);

  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant", block: "end" });
  }, [messages]);

  useEffect(() => {
    let timer = null;
    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      try {
        const data = await api.pollMessages(conversationId, lastId);
        const items = data?.messages;
        if (Array.isArray(items) && items.length) setMessages((prev) => prev.concat(items));
      } catch {}

      try {
        const data2 = await api.pollAiCalls(conversationId, lastAiId);
        const items2 = data2?.calls;
        if (!Array.isArray(items2) || items2.length === 0) return;
        setAiCalls((prev) => prev.concat(items2));
        setAiByTriggerId((prev) => {
          const next = { ...prev };
          for (let i = 0; i < items2.length; i++) {
            const c = items2[i];
            const t = Number(c?.trigger_message_id || 0);
            const id = Number(c?.id || 0);
            if (!t || !id) continue;
            const existing = next[String(t)];
            if (!existing || Number(existing.id || 0) < id) next[String(t)] = c;
          }
          return next;
        });
      } catch {}
    }

    timer = setInterval(poll, 3000);
    poll();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [conversationId, lastId, lastAiId]);

  async function send() {
    const content = text.trim();
    if (!content || sending) return;
    setStatus("");
    setSending(true);
    try {
      const data = await api.reply({ conversation_id: conversationId, message: content, agent_name: "Admin" });
      if (!data?.ok) {
        setStatus(data?.error || data?.detail || "Send failed");
        return;
      }
      setText("");
      setMessages((prev) =>
        prev.concat([
          {
            id: Number(data.message_id || 0),
            role: "agent",
            content,
            created_at: new Date().toISOString()
          }
        ])
      );
    } catch (e) {
      setStatus(e?.data?.error || e?.message || "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div className="messages">
        {messages.map((m) => (
          <div key={`${m.id}-${m.created_at}`} className={`msg ${normalizeRole(m.role)}`}>
            <div className="msgMeta">
              <span className="pill">{normalizeRole(m.role)}</span>
              <span className="mono">{m.created_at ? new Date(m.created_at).toISOString() : ""}</span>
            </div>
            <pre className="msgBody">{m.content}</pre>
            {normalizeRole(m.role) === "user"
              ? (() => {
                  const call = aiByTriggerId[String(m.id || "")];
                  if (!call) return null;
                  return (
                    <div className="mt-2">
                      <div className="d-flex flex-wrap align-items-center gap-2">
                        <span className={call.ok ? "badge text-bg-success" : "badge text-bg-warning"}>{call.ok ? "AI ok" : "AI failed"}</span>
                        {call.model ? <span className="badge text-bg-secondary">{call.model}</span> : null}
                        {call.latency_ms ? <span className="badge text-bg-light text-dark">{call.latency_ms}ms</span> : null}
                        {!call.ok && call.error_type ? <span className="badge text-bg-danger">{call.error_type}</span> : null}
                      </div>
                      {!call.ok ? (
                        <div className="small text-muted mt-1" style={{ whiteSpace: "pre-wrap" }}>
                          {prettyTextOrJson(call.response_json || call.error_message)}
                        </div>
                      ) : call.response_json ? (
                        <details className="mt-1">
                          <summary className="small">View JSON</summary>
                          <pre className="small text-muted" style={{ whiteSpace: "pre-wrap" }}>
                            {prettyTextOrJson(call.response_json)}
                          </pre>
                        </details>
                      ) : null}
                    </div>
                  );
                })()
              : null}
            {normalizeRole(m.role) === "user"
              ? (() => {
                  const meta = parseMeta(m.meta_json);
                  const det = meta?.escalation_detection;
                  if (!det || !det.detected) return null;
                  return (
                    <div className="mt-2">
                      <div className="d-flex flex-wrap align-items-center gap-2">
                        <span className="badge text-bg-info">Escalation</span>
                        <span className="badge text-bg-dark">{String(det.reason || "Unknown")}</span>
                        <span className="badge text-bg-secondary">{String(det.matched_group || "N/A")}</span>
                      </div>
                      <div className="small text-muted mt-1" style={{ whiteSpace: "pre-wrap" }}>
                        {String(det.matched_pattern || "")}
                      </div>
                    </div>
                  );
                })()
              : null}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {canSend ? (
        <>
          <div className="composer">
            <input
              className="input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your reply as human support…"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button className="button" type="button" onClick={send} disabled={sending}>
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
          {status ? (
            <div className="error" style={{ marginTop: 8 }}>
              {status}
            </div>
          ) : null}
        </>
      ) : (
        <div className="text-muted" style={{ marginTop: 10 }}>
          Enable Human chat to send messages.
        </div>
      )}
    </div>
  );
}

