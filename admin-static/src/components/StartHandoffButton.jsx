import React, { useState } from "react";
import { api } from "../api.js";

export default function StartHandoffButton({ conversationId, onDone }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  async function start() {
    if (loading) return;
    setStatus("");
    setLoading(true);
    try {
      const data = await api.startHandoff(conversationId);
      if (!data?.ok) {
        setStatus(data?.error || "Failed");
        return;
      }
      if (onDone) onDone();
    } catch (e) {
      setStatus(e?.data?.error || e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="d-flex align-items-center gap-2">
      <button type="button" className="btn btn-sm btn-outline-primary" onClick={start} disabled={loading}>
        {loading ? "Starting…" : "Human chat"}
      </button>
      {status ? <div className="small text-danger">{status}</div> : null}
    </div>
  );
}

