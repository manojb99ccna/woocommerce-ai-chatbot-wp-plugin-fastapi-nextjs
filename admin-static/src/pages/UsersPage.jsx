import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdminShell from "../components/AdminShell.jsx";
import { api } from "../api.js";

export default function UsersPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError("");
      try {
        const data = await api.listUsers(200);
        if (cancelled) return;
        setRows(Array.isArray(data?.users) ? data.users : []);
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
    <AdminShell active="users" pageTitle="Users">
      <div className="card">
        {loading ? <div className="text-muted">Loading…</div> : null}
        {error ? <div className="small text-danger mb-2">{error}</div> : null}
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
                    <Link className="link mono" to={`/conversations/u/${r.conversation_uid}`}>
                      #{r.id}
                    </Link>
                  </td>
                  <td>{r.contact_name || "—"}</td>
                  <td className="mono">{r.contact_email || "—"}</td>
                  <td className="mono">{r.session_id || "Unknown"}</td>
                  <td className="mono">{r.updated_at ? new Date(r.updated_at).toISOString() : ""}</td>
                </tr>
              ))}
              {!loading && rows.length === 0 ? (
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

