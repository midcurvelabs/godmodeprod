"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListTodo,
  BookOpen,
  FileText,
  Presentation,
  Repeat,
  Newspaper,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
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
      { name: "Prep", href: "/prep", icon: Presentation },
    ],
  },
  {
    label: "POST-PRODUCTION",
    items: [
      { name: "Repurpose Engine", href: "/repurpose", icon: Repeat },
      { name: "Newsletter", href: "/newsletter", icon: Newspaper },
    ],
  },
  {
    label: "SETTINGS",
    items: [{ name: "Show Config", href: "/settings", icon: Settings }],
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          aria-label="Close navigation"
          onClick={onMobileClose}
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        />
      )}
      <aside
        className={`fixed left-0 top-0 h-screen bg-bg-surface border-r border-border flex flex-col transition-transform duration-200 z-50 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${collapsed ? "lg:w-16 w-[220px]" : "w-[220px]"}`}
      >
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-border justify-between">
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
          {mobileOpen && (
            <button
              onClick={onMobileClose}
              className="lg:hidden p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
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
                    onClick={onMobileClose}
                    className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                      isActive
                        ? "text-accent bg-accent/10 border-r-2 border-accent"
                        : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
                    } ${collapsed ? "lg:justify-center lg:px-0" : ""}`}
                  >
                    <Icon size={20} strokeWidth={1.5} />
                    {(!collapsed || mobileOpen) && <span className={collapsed ? "lg:hidden" : ""}>{item.name}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Collapse toggle — desktop only */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex h-10 items-center justify-center border-t border-border text-text-muted hover:text-text-secondary transition-colors"
        >
          {collapsed ? (
            <ChevronRight size={16} />
          ) : (
            <ChevronLeft size={16} />
          )}
        </button>
      </aside>
    </>
  );
}
