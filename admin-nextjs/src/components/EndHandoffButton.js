"use client";

import { useState } from "react";

export default function EndHandoffButton({ conversationId }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  async function end() {
    if (loading) return;
    setStatus("");
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/conversations/${conversationId}/end-handoff`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setStatus(data?.error || "Failed");
        return;
      }
      window.location.reload();
    } catch {
      setStatus("Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="d-flex align-items-center gap-2">
      <button type="button" className="btn btn-sm btn-outline-danger" onClick={end} disabled={loading}>
        {loading ? "Ending…" : "End chat"}
      </button>
      {status ? <div className="small text-danger">{status}</div> : null}
    </div>
  );
}

