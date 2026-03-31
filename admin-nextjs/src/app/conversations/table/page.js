import AdminShell from "@/components/AdminShell";
import { query, table } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getConversations() {
  const conversations = table("conversations");
  const escalations = table("escalations");
  const messages = table("messages");
  const sql = `
    SELECT
      c.id,
      c.conversation_uid,
      c.session_id,
      c.status,
      c.escalation_reason,
      c.updated_at,
      (
        SELECT m.content
        FROM ${messages} m
        WHERE m.conversation_id = c.id
        ORDER BY m.id DESC
        LIMIT 1
      ) AS last_message,
      (
        SELECT e.contact_name
        FROM ${escalations} e
        WHERE e.conversation_id = c.id
        ORDER BY e.id DESC
        LIMIT 1
      ) AS contact_name,
      (
        SELECT e.contact_email
        FROM ${escalations} e
        WHERE e.conversation_id = c.id
        ORDER BY e.id DESC
        LIMIT 1
      ) AS contact_email
    FROM ${conversations} c
    ORDER BY c.updated_at DESC
    LIMIT 200
  `;
  return await query(sql);
}

export default async function ConversationsTablePage() {
  const rows = await getConversations();
  return (
    <AdminShell active="conversations" pageTitle="All Conversations">
      <div className="card">
        <div className="tableWrap">
          <table className="table table-striped">
            <thead>
              <tr>
                <th>ID</th>
                <th>Status</th>
                <th>Session</th>
                <th>Contact</th>
                <th>Last message</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <a className="link mono" href={`/conversations/u/${r.conversation_uid}`}>
                      #{r.id}
                    </a>
                  </td>
                  <td>
                    <span className={r.status === "escalated" ? "pill pillRed" : "pill"}>{r.status}</span>
                    {r.escalation_reason ? <div className="muted">{r.escalation_reason}</div> : null}
                  </td>
                  <td className="mono">{r.session_id || "Unknown"}</td>
                  <td>
                    <div>{r.contact_name || "—"}</div>
                    <div className="muted">{r.contact_email || ""}</div>
                  </td>
                  <td className="truncate">{r.last_message || ""}</td>
                  <td className="mono">{r.updated_at ? new Date(r.updated_at).toISOString() : ""}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-muted">
                    No rows yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}

