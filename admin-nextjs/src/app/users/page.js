import AdminShell from "@/components/AdminShell";
import { query, table } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getUsers() {
  const escalations = table("escalations");
  const conversations = table("conversations");
  const sql = `
    SELECT
      c.id,
      c.conversation_uid,
      c.session_id,
      MAX(e.contact_name) AS contact_name,
      MAX(e.contact_email) AS contact_email,
      MAX(c.updated_at) AS updated_at
    FROM ${conversations} c
    LEFT JOIN ${escalations} e ON e.conversation_id = c.id
    GROUP BY c.id, c.conversation_uid, c.session_id
    ORDER BY updated_at DESC
    LIMIT 200
  `;
  return await query(sql);
}

export default async function UsersPage() {
  const rows = await getUsers();
  return (
    <AdminShell active="users" pageTitle="Users">
      <div className="card">
        <div className="tableWrap">
          <table className="table table-striped">
            <thead>
              <tr>
                <th>Conversation</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Session</th>
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
                  <td>{r.contact_name || "—"}</td>
                  <td className="mono">{r.contact_email || "—"}</td>
                  <td className="mono">{r.session_id || "Unknown"}</td>
                  <td className="mono">{r.updated_at ? new Date(r.updated_at).toISOString() : ""}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-muted">
                    No users yet
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
