import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../App.jsx";

export default function LoginPage({ nextPath = "/conversations" }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setStatus("");
    setLoading(true);
    try {
      await auth.login(username, password);
      navigate(nextPath, { replace: true });
    } catch (e2) {
      setStatus(e2?.data?.error || e2?.message || "Login failed");
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

