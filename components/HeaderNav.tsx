"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Profile } from "@/types/database";

const MACHINE_NAV = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/machines/tandem", label: "Tandem", icon: "⚙️" },
  { href: "/machines/blanking", label: "Blanking", icon: "⚙️" },
  { href: "/machines/transfer-2000t", label: "Transfer 2000t", icon: "⚙️" },
  { href: "/machines/transfer-800t", label: "Transfer 800t", icon: "⚙️" },
  { href: "/machines/pc200t", label: "PC200t", icon: "⚙️" },
];

interface HeaderNavProps {
  children: React.ReactNode;
}

export default function HeaderNav({ children }: HeaderNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    // Theme sync
    const savedTheme = (localStorage.getItem("theme_v1") as "light" | "dark") || "light";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);

    // Auth check
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserEmail(session.user.email || "");
        // fetch profile
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        if (data) {
          setProfile(data as Profile);
        }
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

  return (
    <div className="app-shell">
      {/* Mobile Topbar */}
      <div className="mobile-topbar">
        <button className="hamburger" onClick={() => setMobileNavOpen(true)}>
          ☰
        </button>
        <span className="mobile-title">Stamping Production System</span>
        <button className="theme-toggle ml-auto" onClick={toggleTheme}>
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
          {MACHINE_NAV.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${isActive ? "active" : ""}`}
              >
                <span>{item.icon}</span>
                {!sidebarCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {!sidebarCollapsed ? (
          <div className="sidebar-foot">
            <div className="who">
              {profile?.full_name || userEmail || "Operator"}
            </div>
            <span
              className={`badge ${
                profile?.role === "admin" ? "role-admin" : ""
              }`}
            >
              {profile?.role || "user"}
            </span>
            <div className="mt-2 flex gap-2 items-center">
              <button
                className="btn-ghost btn-sm flex-1"
                onClick={handleLogout}
              >
                Keluar
              </button>
              <button
                className="btn-ghost btn-sm"
                onClick={toggleTheme}
                title="Toggle Theme"
              >
                {theme === "dark" ? "☀️" : "🌙"}
              </button>
            </div>
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
