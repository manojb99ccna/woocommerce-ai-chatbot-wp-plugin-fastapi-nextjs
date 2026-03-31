import Link from "next/link";

export default function Sidebar({ active }) {
  return (
    <div className="sidebar sidebarDark">
      <div className="sidebarHeader">Admin Menu</div>

      <div className="sidebarGroup">Users</div>
      <div className="nav flex-column nav-pills">
        <Link className={active === "users" ? "nav-link active" : "nav-link"} href="/users">
          All Users
        </Link>
      </div>

      <div className="sidebarGroup">Conversations</div>
      <div className="nav flex-column nav-pills">
        <Link className={active === "inbox" ? "nav-link active" : "nav-link"} href="/conversations">
          Inbox
        </Link>
        <Link className={active === "conversations" ? "nav-link active" : "nav-link"} href="/conversations/table">
          All Conversations
        </Link>
      </div>
    </div>
  );
}
