"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { EpisodeBar } from "@/components/layout/episode-bar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  return (
    <div className="min-h-screen">
      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
      <div className="lg:ml-[220px]">
        <div className="flex items-stretch lg:block">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="lg:hidden px-3 flex items-center text-text-secondary hover:text-text-primary border-r border-b border-border bg-bg-surface"
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <EpisodeBar />
          </div>
        </div>
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
