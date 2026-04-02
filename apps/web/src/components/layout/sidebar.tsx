"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListTodo,
  BookOpen,
  FileText,
  Repeat,
  Film,
  Layers,
  Newspaper,
  Image,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

const NAV_SECTIONS = [
  {
    label: "PRODUCTION",
    items: [
      { name: "Episodes", href: "/episodes", icon: LayoutDashboard },
      { name: "Docket", href: "/docket", icon: ListTodo },
      { name: "Research Brief", href: "/research", icon: BookOpen },
      { name: "Runsheet", href: "/runsheet", icon: FileText },
    ],
  },
  {
    label: "POST-PRODUCTION",
    items: [
      { name: "Repurpose Engine", href: "/repurpose", icon: Repeat },
      { name: "Video Pipeline", href: "/video", icon: Film },
      { name: "Mashup Maker", href: "/mashup", icon: Layers },
      { name: "Newsletter", href: "/newsletter", icon: Newspaper },
      { name: "Thumbnails", href: "/thumbnail", icon: Image },
    ],
  },
  {
    label: "SETTINGS",
    items: [{ name: "Show Config", href: "/settings", icon: Settings }],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-bg-surface border-r border-border flex flex-col transition-all duration-200 z-40 ${
        collapsed ? "w-16" : "w-[220px]"
      }`}
    >
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-border">
        {!collapsed && (
          <span className="font-display text-2xl tracking-wide text-accent">
            GMP
          </span>
        )}
        {collapsed && (
          <span className="font-display text-2xl tracking-wide text-accent mx-auto">
            G
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-6">
            {!collapsed && (
              <p className="px-4 mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
                {section.label}
              </p>
            )}
            {section.items.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                    isActive
                      ? "text-accent bg-accent/10 border-r-2 border-accent"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
                  } ${collapsed ? "justify-center px-0" : ""}`}
                >
                  <Icon size={20} strokeWidth={1.5} />
                  {!collapsed && <span>{item.name}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="h-10 flex items-center justify-center border-t border-border text-text-muted hover:text-text-secondary transition-colors"
      >
        {collapsed ? (
          <ChevronRight size={16} />
        ) : (
          <ChevronLeft size={16} />
        )}
      </button>
    </aside>
  );
}
