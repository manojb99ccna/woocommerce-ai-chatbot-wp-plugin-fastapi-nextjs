import Link from "next/link";
import Sidebar from "@/components/Sidebar";

export default function AdminShell({ children, active, secondary, pageTitle }) {
  return (
    <div className="shell">
      <nav className="navbar navbar-expand navbar-light bg-white border-bottom sticky-top">
        <div className="container-fluid">
          <Link href="/dashboard" className="navbar-brand">
            Chatbot Ecom
          </Link>
          <div className="ms-auto">
            <a className="btn btn-outline-secondary btn-sm" href="/api/logout">
              Logout
            </a>
          </div>
        </div>
      </nav>

      <div className="adminBody">
        <aside className="adminPrimary">
          <Sidebar active={active} />
        </aside>
        {secondary ? <aside className="adminSecondary">{secondary}</aside> : null}
        <section className="adminContent">
          {pageTitle ? <div className="adminTitle">{pageTitle}</div> : null}
          {children}
        </section>
      </div>
    </div>
  );
}
