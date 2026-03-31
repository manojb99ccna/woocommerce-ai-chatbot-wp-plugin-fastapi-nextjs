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
      c.site_url,
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

export default async function DashboardPage() {
  const rows = await getConversations();

  return (
    <AdminShell active="inbox" pageTitle="Dashboard">
      <div className="card">
        <div className="row">
          <h2 className="h2">Inbox</h2>
          <div className="text-muted">Open Inbox from sidebar to start chatting.</div>
        </div>
        <div className="text-muted">
          Latest conversations:{" "}
          {rows.slice(0, 5).map((r) => (
            <a key={r.id} className="link mono" href={`/conversations/u/${r.conversation_uid}`} style={{ marginRight: 10 }}>
              #{r.id}
            </a>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
