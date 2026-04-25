import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { api } from "./api.js";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import UsersPage from "./pages/UsersPage.jsx";
import InboxPage from "./pages/InboxPage.jsx";
import ConversationUidPage from "./pages/ConversationUidPage.jsx";
import ConversationsTablePage from "./pages/ConversationsTablePage.jsx";

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }) {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const data = await api.me();
        if (cancelled) return;
        if (data?.ok) setUser({ username: data.username || "admin" });
      } catch {
        if (cancelled) return;
        setUser(null);
      } finally {
        if (cancelled) return;
        setChecking(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      checking,
      user,
      isAuthed: Boolean(user),
      async login(username, password) {
        await api.login(username, password);
        const data = await api.me();
        setUser({ username: data?.username || "admin" });
      },
      async logout() {
        try {
          await api.logout();
        } catch {}
        setUser(null);
      }
    }),
    [checking, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function RequireAuth({ children }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.checking) return <div className="page">Loading…</div>;
  if (!auth.isAuthed) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

function LoginRoute() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/conversations";

  useEffect(() => {
    if (!auth.checking && auth.isAuthed) navigate(from, { replace: true });
  }, [auth.checking, auth.isAuthed, from, navigate]);

  if (auth.checking) return <div className="page">Loading…</div>;
  return <LoginPage nextPath={from} />;
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/conversations" replace />} />
          <Route path="/login" element={<LoginRoute />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/users"
            element={
              <RequireAuth>
                <UsersPage />
              </RequireAuth>
            }
          />
          <Route
            path="/conversations"
            element={
              <RequireAuth>
                <InboxPage />
              </RequireAuth>
            }
          />
          <Route
            path="/conversations/table"
            element={
              <RequireAuth>
                <ConversationsTablePage />
              </RequireAuth>
            }
          />
          <Route
            path="/conversations/u/:uid"
            element={
              <RequireAuth>
                <ConversationUidPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/conversations" replace />} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
}

