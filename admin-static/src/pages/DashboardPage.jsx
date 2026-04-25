import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdminShell from "../components/AdminShell.jsx";
import { api } from "../api.js";

export default function DashboardPage() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const data = await api.listConversations(20);
        if (cancelled) return;
        setRows(Array.isArray(data?.conversations) ? data.conversations : []);
      } catch {
        if (cancelled) return;
        setRows([]);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

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
            <Link key={r.id} className="link mono" to={`/conversations/u/${r.conversation_uid}`} style={{ marginRight: 10 }}>
              #{r.id}
            </Link>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}

