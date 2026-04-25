import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

export default function ConversationsPanel({ activeUid }) {
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
    const t = setInterval(run, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="h-100 p-2">
      <div className="fw-bold mb-2">Conversations</div>
      {loading ? <div className="text-muted">Loading…</div> : null}
      {error ? <div className="small text-danger mb-2">{error}</div> : null}
      <div className="list-group">
        {rows.map((r) => {
          const isActive = String(r.conversation_uid) === String(activeUid || "");
          return (
            <Link
              key={r.id}
              to={`/conversations/u/${r.conversation_uid}`}
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
            </Link>
          );
        })}
        {!loading && rows.length === 0 ? <div className="text-muted">No conversations</div> : null}
      </div>
    </div>
  );
}

