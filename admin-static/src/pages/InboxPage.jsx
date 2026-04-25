import React from "react";
import AdminShell from "../components/AdminShell.jsx";
import ConversationsPanel from "../components/ConversationsPanel.jsx";

export default function InboxPage() {
  return (
    <AdminShell active="inbox" pageTitle="Inbox" secondary={<ConversationsPanel />}>
      <div className="card">
        <div className="fw-bold mb-2">Select a conversation</div>
        <div className="text-muted">Choose a conversation from the middle list to open the live chat.</div>
      </div>
    </AdminShell>
  );
}

