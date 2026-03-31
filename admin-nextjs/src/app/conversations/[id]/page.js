import AdminShell from "@/components/AdminShell";
import ConversationChatClient from "@/components/ConversationChatClient";
import { query, table } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getConversation(conversationId) {
  const conversations = table("conversations");
  const sql = `SELECT * FROM ${conversations} WHERE id = ? LIMIT 1`;
  const rows = await query(sql, [conversationId]);
  return rows[0] || null;
}

async function getMessages(conversationId) {
  const messages = table("messages");
  const sql = `SELECT id, created_at, role, content FROM ${messages} WHERE conversation_id = ? ORDER BY id ASC LIMIT 500`;
  return await query(sql, [conversationId]);
}

async function getEscalations(conversationId) {
  const escalations = table("escalations");
  const sql = `SELECT id, created_at, source, reason, contact_name, contact_email, note, make_webhook_ok, make_webhook_error FROM ${escalations} WHERE conversation_id = ? ORDER BY id DESC LIMIT 50`;
  return await query(sql, [conversationId]);
}

async function getMakeLogs(conversationId) {
  const makeLogs = table("make_webhook_logs");
  const escalations = table("escalations");
  const sql = `
    SELECT ml.id, ml.created_at, ml.event, ml.request_id, ml.session_id, ml.reason, ml.response_status, ml.ok, ml.error
    FROM ${makeLogs} ml
    JOIN ${escalations} e ON e.id = ml.escalation_id
    WHERE e.conversation_id = ?
    ORDER BY ml.id DESC
    LIMIT 50
  `;
  return await query(sql, [conversationId]);
}

export default async function ConversationPage(props) {
  const params = await props.params;
  const id = Number(params?.id);
  const conversation = await getConversation(id);
  const messages = await getMessages(id);
  const escalations = await getEscalations(id);
  const makeLogs = await getMakeLogs(id);

  return (
    <AdminShell title={`Conversation #${id}`}>
      {!conversation ? (
        <div className="card">Not found</div>
      ) : (
        <>
          <div className="card">
            <div className="row">
              <h2 className="h2">Summary</h2>
              <span className={conversation.status === "escalated" ? "pill pillRed" : "pill"}>{conversation.status}</span>
            </div>
            <div className="grid2">
              <div>
                <div className="muted">Session ID</div>
                <div className="mono">{conversation.session_id || "Unknown"}</div>
              </div>
              <div>
                <div className="muted">Site URL</div>
                <div className="mono">{conversation.site_url || "Unknown"}</div>
              </div>
              <div>
                <div className="muted">Escalation reason</div>
                <div className="mono">{conversation.escalation_reason || "N/A"}</div>
              </div>
              <div>
                <div className="muted">Updated</div>
                <div className="mono">{conversation.updated_at ? new Date(conversation.updated_at).toISOString() : ""}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="h2">Messages</h2>
            <ConversationChatClient conversationId={id} initialMessages={messages} />
          </div>

          <div className="card">
            <h2 className="h2">Escalations</h2>
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>When</th>
                    <th>Source</th>
                    <th>Reason</th>
                    <th>Contact</th>
                    <th>Note</th>
                    <th>Make</th>
                  </tr>
                </thead>
                <tbody>
                  {escalations.map((e) => (
                    <tr key={e.id}>
                      <td className="mono">{e.id}</td>
                      <td className="mono">{e.created_at ? new Date(e.created_at).toISOString() : ""}</td>
                      <td>{e.source}</td>
                      <td>{e.reason}</td>
                      <td>
                        <div>{e.contact_name || "—"}</div>
                        <div className="muted">{e.contact_email || ""}</div>
                      </td>
                      <td className="truncate">{e.note || ""}</td>
                      <td>
                        <span className={e.make_webhook_ok ? "pill" : "pill pillRed"}>{e.make_webhook_ok ? "ok" : "pending/error"}</span>
                        {e.make_webhook_error ? <div className="muted truncate">{e.make_webhook_error}</div> : null}
                      </td>
                    </tr>
                  ))}
                  {escalations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="muted">
                        No escalations
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h2 className="h2">Make Webhook Logs</h2>
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>When</th>
                    <th>Event</th>
                    <th>Status</th>
                    <th>OK</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {makeLogs.map((l) => (
                    <tr key={l.id}>
                      <td className="mono">{l.id}</td>
                      <td className="mono">{l.created_at ? new Date(l.created_at).toISOString() : ""}</td>
                      <td className="mono">{l.event}</td>
                      <td className="mono">{l.response_status || "—"}</td>
                      <td>
                        <span className={l.ok ? "pill" : "pill pillRed"}>{l.ok ? "yes" : "no"}</span>
                      </td>
                      <td className="truncate">{l.error || ""}</td>
                    </tr>
                  ))}
                  {makeLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="muted">
                        No Make logs
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AdminShell>
  );
}
