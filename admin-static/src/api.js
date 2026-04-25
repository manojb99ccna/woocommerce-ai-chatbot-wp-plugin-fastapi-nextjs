const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "https://aichatbotbackend.webexcello.com").replace(/\/+$/, "");

async function request(path, { method = "GET", body, headers } = {}) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(headers || {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(data?.error || data?.detail || `HTTP_${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  backendUrl: BACKEND_URL,
  login: (username, password) => request("/admin/auth/login", { method: "POST", body: { username, password } }),
  logout: () => request("/admin/auth/logout", { method: "POST" }),
  me: () => request("/admin/auth/me"),
  listConversations: (limit = 200) => request(`/admin/conversations?limit=${encodeURIComponent(String(limit))}`),
  listUsers: (limit = 200) => request(`/admin/users?limit=${encodeURIComponent(String(limit))}`),
  conversationSnapshotByUid: (uid) => request(`/admin/conversations/by-uid/${encodeURIComponent(String(uid))}/snapshot`),
  pollMessages: (conversationId, afterId) =>
    request(`/admin/conversations/${encodeURIComponent(String(conversationId))}/messages?after_id=${encodeURIComponent(String(afterId || 0))}`),
  pollAiCalls: (conversationId, afterId) =>
    request(`/admin/conversations/${encodeURIComponent(String(conversationId))}/ai-calls?after_id=${encodeURIComponent(String(afterId || 0))}`),
  reply: ({ conversation_id, message, agent_name }) =>
    request("/admin/agent/reply", { method: "POST", body: { conversation_id, message, agent_name } }),
  startHandoff: (conversationId) =>
    request(`/admin/conversations/${encodeURIComponent(String(conversationId))}/start-handoff`, { method: "POST" }),
  endHandoff: (conversationId) => request(`/admin/conversations/${encodeURIComponent(String(conversationId))}/end-handoff`, { method: "POST" })
};

