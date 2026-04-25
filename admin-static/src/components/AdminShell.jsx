import React from "react";
import { Link, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import { useAuth } from "../App.jsx";

export default function AdminShell({ children, active, secondary, pageTitle }) {
  const auth = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await auth.logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="shell">
      <nav className="navbar navbar-expand navbar-light bg-white border-bottom sticky-top">
        <div className="container-fluid">
          <Link to="/dashboard" className="navbar-brand">
            Chatbot Ecom
          </Link>
          <div className="ms-auto">
            <button className="btn btn-outline-secondary btn-sm" type="button" onClick={onLogout}>
              Logout
            </button>
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

