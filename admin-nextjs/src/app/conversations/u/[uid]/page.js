import AdminShell from "@/components/AdminShell";
import ConversationsPanel from "@/components/ConversationsPanel";
import ConversationChatClient from "@/components/ConversationChatClient";
import EndHandoffButton from "@/components/EndHandoffButton";
import StartHandoffButton from "@/components/StartHandoffButton";
import { query, table } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getConversationByUid(conversationUid) {
  const conversations = table("conversations");
  const sql = `SELECT * FROM ${conversations} WHERE conversation_uid = ? LIMIT 1`;
  const rows = await query(sql, [conversationUid]);
  return rows[0] || null;
}

async function getMessages(conversationId) {
  const messages = table("messages");
  const sql = `SELECT id, created_at, role, content, meta_json FROM ${messages} WHERE conversation_id = ? ORDER BY id ASC LIMIT 500`;
  return await query(sql, [conversationId]);
}

async function getEscalations(conversationId) {
  const escalations = table("escalations");
  const sql = `SELECT id, created_at, source, reason, contact_name, contact_email, note, make_webhook_ok, make_webhook_error FROM ${escalations} WHERE conversation_id = ? ORDER BY id DESC LIMIT 50`;
  return await query(sql, [conversationId]);
}

async function getOpenAiCalls(conversationId) {
  const calls = table("openai_calls");
  const sql = `SELECT id, created_at, ok, model, latency_ms, error_type, error_message FROM ${calls} WHERE conversation_id = ? ORDER BY id DESC LIMIT 5`;
  return await query(sql, [conversationId]);
}

async function getOpenAiCallsForMessages(conversationId) {
  const calls = table("openai_calls");
  const sql = `SELECT id, created_at, trigger_message_id, ok, model, latency_ms, error_type, error_message FROM ${calls} WHERE conversation_id = ? ORDER BY id ASC LIMIT 500`;
  return await query(sql, [conversationId]);
}

export default async function ConversationUidPage(props) {
  const params = await props.params;
  const uid = String(params?.uid || "");
  const conversation = uid ? await getConversationByUid(uid) : null;

  if (!conversation) {
    return (
      <AdminShell active="inbox" pageTitle="Inbox" secondary={<ConversationsPanel activeUid={uid} />}>
        <div className="card">Not found</div>
      </AdminShell>
    );
  }

  const conversationId = Number(conversation.id);
  const messages = await getMessages(conversationId);
  const escalations = await getEscalations(conversationId);
  const openAiCalls = await getOpenAiCalls(conversationId);
  const openAiCallsForMessages = await getOpenAiCallsForMessages(conversationId);
  const latestCall = openAiCalls && openAiCalls.length ? openAiCalls[0] : null;

  return (
    <AdminShell active="inbox" pageTitle="Inbox" secondary={<ConversationsPanel activeUid={uid} />}>
      <div className="card mb-3">
        <div className="d-flex justify-content-between align-items-center">
          <div className="fw-bold">Conversation</div>
          <div className="d-flex align-items-center gap-2">
            <span className={conversation.status === "escalated" ? "badge text-bg-danger" : "badge text-bg-secondary"}>{conversation.status}</span>
            {conversation.status === "escalated" ? <EndHandoffButton conversationId={conversationId} /> : null}
            {conversation.status !== "escalated" ? <StartHandoffButton conversationId={conversationId} /> : null}
          </div>
        </div>
        <div className="row mt-2">
          <div className="col-12 col-md-6">
            <div className="text-muted">Contact</div>
            <div className="mono">{(conversation.contact_email || escalations[0]?.contact_email || "Unknown").toString()}</div>
          </div>
          <div className="col-12 col-md-6">
            <div className="text-muted">Reason</div>
            <div className="mono">{(conversation.escalation_reason || "N/A").toString()}</div>
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
