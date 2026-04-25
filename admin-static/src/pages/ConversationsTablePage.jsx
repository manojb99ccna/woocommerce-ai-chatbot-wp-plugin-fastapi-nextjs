import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdminShell from "../components/AdminShell.jsx";
import { api } from "../api.js";

export default function ConversationsTablePage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError("");
      try {
        const data = await api.listConversations(200);
        if (cancelled) return;
        setRows(Array.isArray(data?.conversations) ? data.conversations : []);
      } catch (e) {
        if (cancelled) return;
        setError(e?.data?.error || e?.message || "Failed");
        setRows([]);
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminShell active="conversations" pageTitle="All Conversations">
      <div className="card">
        {loading ? <div className="text-muted">Loading…</div> : null}
        {error ? <div className="small text-danger mb-2">{error}</div> : null}
        <div className="tableWrap">
          <table className="table table-striped">
            <thead>
              <tr>
                <th>ID</th>
                <th>Status</th>
                <th>Contact</th>
                <th>Session</th>
                <th>Updated</th>
                <th>Last message</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">
                    <Link className="link mono" to={`/conversations/u/${r.conversation_uid}`}>
                      #{r.id}
                    </Link>
                  </td>
                  <td>
                    <span className={r.status === "escalated" ? "badge text-bg-danger" : "badge text-bg-secondary"}>{r.status}</span>
                  </td>
                  <td className="mono">{r.contact_email || "—"}</td>
                  <td className="mono">{r.session_id || "—"}</td>
                  <td className="mono">{r.updated_at ? new Date(r.updated_at).toISOString() : ""}</td>
                  <td className="truncate">{r.last_message || ""}</td>
                </tr>
              ))}
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-muted">
                    No conversations
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

