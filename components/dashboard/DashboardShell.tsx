"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { Footer } from "./Footer";

interface DashboardShellProps {
  email: string;
  displayName: string;
  initials: string;
  children: React.ReactNode;
}

export function DashboardShell({
  email,
  displayName,
  initials,
  children,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        account={{ displayName, initials, email }}
        mobileOpen={mobileOpen}
        collapsed={collapsed}
        onClose={() => setMobileOpen(false)}
        onToggleCollapse={() => setCollapsed((c) => !c)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          user={{ displayName, initials }}
          onMenuToggle={() => setMobileOpen((o) => !o)}
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
