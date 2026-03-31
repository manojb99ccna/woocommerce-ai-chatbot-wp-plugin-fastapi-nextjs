import { query, table } from "@/lib/db";

export default async function ConversationsPanel({ activeUid }) {
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

  const rows = await query(sql);

  return (
    <div className="h-100 p-2">
      <div className="fw-bold mb-2">Conversations</div>
      <div className="list-group">
        {rows.map((r) => {
          const isActive = String(r.conversation_uid) === String(activeUid || "");
          return (
            <a
              key={r.id}
              href={`/conversations/u/${r.conversation_uid}`}
              className={isActive ? "list-group-item list-group-item-action active" : "list-group-item list-group-item-action"}
            >
              <div className="d-flex justify-content-between align-items-center">
                <div className="fw-semibold text-truncate" style={{ maxWidth: 220 }}>
                  {r.contact_email || r.session_id || "Unknown"}
                </div>
                <span className={r.status === "escalated" ? "badge text-bg-danger" : "badge text-bg-secondary"}>{r.status}</span>
              </div>
              <div className="small text-truncate" style={{ maxWidth: 260 }}>
                {r.last_message || ""}
              </div>
              <div className="small">{r.escalation_reason || ""}</div>
            </a>
          );
        })}
        {rows.length === 0 ? <div className="text-muted">No conversations</div> : null}
      </div>
    </div>
  );
}

