"use client";

import { HostFilter } from "./host-filter";

export type TabKey = "overview" | "shorts" | "twitter" | "linkedin" | "youtube" | "schedule";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "shorts", label: "Shorts Captions" },
  { key: "twitter", label: "Twitter" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "youtube", label: "YouTube" },
  { key: "schedule", label: "Schedule" },
];

interface OutputTabsProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  hosts: string[];
  selectedHost: string | null;
  onHostChange: (host: string | null) => void;
  approvedCount: number;
  totalCount: number;
}

export function OutputTabs({
  activeTab,
  onTabChange,
  hosts,
  selectedHost,
  onHostChange,
  approvedCount,
  totalCount,
}: OutputTabsProps) {
  return (
    <div className="p-3 border-b border-border flex items-center gap-2 flex-wrap">
      <div className="flex gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-accent/15 text-accent"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1" />
      {hosts.length > 0 && activeTab !== "schedule" && activeTab !== "overview" && (
        <HostFilter hosts={hosts} selected={selectedHost} onChange={onHostChange} />
      )}
      {totalCount > 0 && (
        <span className="text-xs text-text-muted">
          {approvedCount}/{totalCount} approved
        </span>
      )}
    </div>
  );
}
