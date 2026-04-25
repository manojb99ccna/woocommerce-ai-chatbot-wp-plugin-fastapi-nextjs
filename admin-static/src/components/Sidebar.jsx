import React from "react";
import { NavLink } from "react-router-dom";

export default function Sidebar({ active }) {
  return (
    <div className="sidebar sidebarDark">
      <div className="sidebarHeader">Admin Menu</div>

      <div className="sidebarGroup">Users</div>
      <div className="nav flex-column nav-pills">
        <NavLink className={active === "users" ? "nav-link active" : "nav-link"} to="/users">
          All Users
        </NavLink>
      </div>

      <div className="sidebarGroup">Conversations</div>
      <div className="nav flex-column nav-pills">
        <NavLink className={active === "inbox" ? "nav-link active" : "nav-link"} to="/conversations">
          Inbox
        </NavLink>
        <NavLink className={active === "conversations" ? "nav-link active" : "nav-link"} to="/conversations/table">
          All Conversations
        </NavLink>
      </div>
    </div>
  );
}

