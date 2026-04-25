import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import AdminShell from "../components/AdminShell.jsx";
import ConversationsPanel from "../components/ConversationsPanel.jsx";
import ConversationChatClient from "../components/ConversationChatClient.jsx";
import EndHandoffButton from "../components/EndHandoffButton.jsx";
import StartHandoffButton from "../components/StartHandoffButton.jsx";
import { api } from "../api.js";

export default function ConversationUidPage() {
  const params = useParams();
  const uid = String(params?.uid || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.conversationSnapshotByUid(uid);
      setSnapshot(data);
    } catch (e) {
      setSnapshot(null);
      setError(e?.data?.error || e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    load();
  }, [uid, load]);

  const conversation = snapshot?.conversation || null;
  const conversationId = conversation?.id ? Number(conversation.id) : 0;
  const messages = Array.isArray(snapshot?.messages) ? snapshot.messages : [];
  const escalations = Array.isArray(snapshot?.escalations) ? snapshot.escalations : [];
  const openAiCalls = Array.isArray(snapshot?.openai_calls_last5) ? snapshot.openai_calls_last5 : [];
  const openAiCallsForMessages = Array.isArray(snapshot?.openai_calls_for_messages) ? snapshot.openai_calls_for_messages : [];

  if (!uid) {
    return (
      <AdminShell active="inbox" pageTitle="Inbox" secondary={<ConversationsPanel activeUid={uid} />}>
        <div className="card">Not found</div>
      </AdminShell>
    );
  }

  if (loading) {
    return (
      <AdminShell active="inbox" pageTitle="Inbox" secondary={<ConversationsPanel activeUid={uid} />}>
        <div className="card">Loading…</div>
      </AdminShell>
    );
  }

  if (!conversation || !conversationId) {
    return (
      <AdminShell active="inbox" pageTitle="Inbox" secondary={<ConversationsPanel activeUid={uid} />}>
        <div className="card">{error || "Not found"}</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell active="inbox" pageTitle="Inbox" secondary={<ConversationsPanel activeUid={uid} />}>
      <div className="card mb-3">
        <div className="d-flex justify-content-between align-items-center">
          <div className="fw-bold">Conversation</div>
          <div className="d-flex align-items-center gap-2">
            <span className={conversation.status === "escalated" ? "badge text-bg-danger" : "badge text-bg-secondary"}>{conversation.status}</span>
            {conversation.status === "escalated" ? <EndHandoffButton conversationId={conversationId} onDone={load} /> : null}
            {conversation.status !== "escalated" ? <StartHandoffButton conversationId={conversationId} onDone={load} /> : null}
          </div>
        </div>
        <div className="row mt-2">
          <div className="col-12 col-md-6">
            <div className="text-muted">Contact</div>
            <div className="mono">{String(conversation.contact_email || escalations[0]?.contact_email || "Unknown")}</div>
          </div>
          <div className="col-12 col-md-6">
            <div className="text-muted">Reason</div>
            <div className="mono">{String(conversation.escalation_reason || "N/A")}</div>
          </div>
        </div>
      </div>

      <details className="card mb-3">
        <summary className="fw-bold" style={{ cursor: "pointer" }}>
          AI logs (last 5)
        </summary>
        <div className="tableWrap" style={{ marginTop: 10 }}>
          <table className="table table-sm">
            <thead>
              <tr>
                <th>ID</th>
                <th>When</th>
                <th>OK</th>
                <th>Model</th>
                <th>Latency</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {openAiCalls.map((c) => (
                <tr key={c.id}>
                  <td className="mono">{c.id}</td>
                  <td className="mono">{c.created_at ? new Date(c.created_at).toISOString() : ""}</td>
                  <td>{c.ok ? "yes" : "no"}</td>
                  <td className="mono">{c.model || ""}</td>
                  <td className="mono">{c.latency_ms ? `${c.latency_ms}ms` : ""}</td>
                  <td className="mono">{c.ok ? "" : `${c.error_type || ""} ${c.error_message || ""}`}</td>
                </tr>
              ))}
              {openAiCalls.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-muted">
                    No OpenAI calls for this conversation yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </details>

      <div className="card">
        <ConversationChatClient
          conversationId={conversationId}
          initialMessages={messages}
          initialAiCalls={openAiCallsForMessages}
          canSend={conversation.status === "escalated"}
        />
      </div>
    </AdminShell>
  );
}

