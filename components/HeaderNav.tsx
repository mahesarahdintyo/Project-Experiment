"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Profile } from "@/types/database";

interface HeaderNavProps {
  children: React.ReactNode;
  profile?: Profile | null;
  activeTitle?: string;
}

export default function HeaderNav({ children, activeTitle }: HeaderNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    const savedTheme = (localStorage.getItem("theme_v1") as "light" | "dark") || "light";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);

    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserEmail(session.user.email || "");
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        if (data) setProfile(data as Profile);
      }
    };
    checkUser();
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("theme_v1", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isLeaderOrAdmin = profile && ["admin", "leader"].includes(profile.role || "");

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <div className="app-shell">
      {/* Mobile Topbar */}
      <div className="mobile-topbar">
        <button className="hamburger" onClick={() => setMobileNavOpen(true)}>
          ☰
        </button>
        <span className="mobile-title">{activeTitle || "Press Shop System"}</span>
        <button className="theme-toggle" style={{ marginLeft: "auto" }} onClick={toggleTheme}>
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>

      {/* Overlay for mobile */}
      {mobileNavOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""} ${
          sidebarCollapsed ? "sidebar-collapsed" : ""
        }`}
      >
        <button
          className="sidebar-collapse-btn"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? "Buka menu" : "Ciutkan menu"}
        >
          <span>{sidebarCollapsed ? "›" : "‹"}</span>
        </button>

        {!sidebarCollapsed && (
          <div className="sidebar-brand">
            PRESS SHOP<span>·</span>SYSTEM
          </div>
        )}

        <nav className="sidebar-nav" onClick={() => setMobileNavOpen(false)}>
          {/* Dashboard */}
          <Link
            href="/"
            className={`sidebar-link ${isActive("/") ? "active" : ""}`}
            title="Dashboard"
          >
            <span>🏠</span>
            {!sidebarCollapsed && <span>Dashboard</span>}
          </Link>

          {/* Input Produksi — semua user */}
          <Link
            href="/input-produksi"
            className={`sidebar-link ${isActive("/input-produksi") ? "active" : ""}`}
            title="Input Produksi"
          >
            <span>⚙️</span>
            {!sidebarCollapsed && <span>Input Produksi</span>}
          </Link>

          {/* Input Attendance — admin/leader */}
          {isLeaderOrAdmin && (
            <Link
              href="/input-attendance"
              className={`sidebar-link ${isActive("/input-attendance") ? "active" : ""}`}
              title="Input Attendance"
            >
              <span>👥</span>
              {!sidebarCollapsed && <span>Input Attendance</span>}
            </Link>
          )}

          {/* Input Scrap — admin/leader */}
          {isLeaderOrAdmin && (
            <Link
              href="/input-scrap"
              className={`sidebar-link ${isActive("/input-scrap") ? "active" : ""}`}
              title="Input Scrap"
            >
              <span>♻️</span>
              {!sidebarCollapsed && <span>Input Scrap</span>}
            </Link>
          )}

          {/* Input Safety — admin/leader */}
          {isLeaderOrAdmin && (
            <Link
              href="/input-safety"
              className={`sidebar-link ${isActive("/input-safety") ? "active" : ""}`}
              title="Input Safety"
            >
              <span>⛑️</span>
              {!sidebarCollapsed && <span>Input Safety</span>}
            </Link>
          )}
        </nav>

        {!sidebarCollapsed ? (
          <div className="sidebar-foot">
            <div className="who">{profile?.full_name || userEmail || "Operator"}</div>
            <span
              className={`badge ${profile?.role === "admin" ? "role-admin" : ""}`}
            >
              {profile?.role || "user"}
            </span>
            <button
              className="btn-ghost btn-sm"
              style={{ marginTop: "10px", width: "100%" }}
              onClick={handleLogout}
            >
              Keluar
            </button>
          </div>
        ) : (
          <button
            className="sidebar-logout-collapsed"
            onClick={handleLogout}
            title="Keluar"
          >
            ⏻
          </button>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="main">{children}</main>
    </div>
  );
}
