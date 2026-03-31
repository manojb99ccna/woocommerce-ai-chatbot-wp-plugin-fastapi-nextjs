"use client";

import { useEffect, useState } from "react";

export default function LoginPage() {
  const [nextPath, setNextPath] = useState("/dashboard");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next");
      if (next) setNextPath(next);
    } catch {}
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setStatus("");
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setStatus(data?.error || "Login failed");
        return;
      }
      window.location.href = nextPath;
    } catch {
      setStatus("Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="card">
        <h1 className="h1">Chatbot Ecom Admin</h1>
        <p className="muted">Sign in to view chats and escalations.</p>
        <form onSubmit={onSubmit} className="form">
          <label className="label">
            Username
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </label>
          <label className="label">
            Password
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <button className="button" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
          {status ? <div className="error">{status}</div> : null}
        </form>
      </div>
    </div>
  );
}
