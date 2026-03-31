import AdminShell from "@/components/AdminShell";
import ConversationsPanel from "@/components/ConversationsPanel";

export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
  return (
    <AdminShell active="inbox" pageTitle="Inbox" secondary={<ConversationsPanel />}>
      <div className="card">
        <div className="fw-bold mb-2">Select a conversation</div>
        <div className="text-muted">Choose a conversation from the middle list to open the live chat.</div>
      </div>
    </AdminShell>
  );
}
