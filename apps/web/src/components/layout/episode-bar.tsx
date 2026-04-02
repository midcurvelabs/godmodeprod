"use client";

import { ChevronDown, Plus } from "lucide-react";

export function EpisodeBar() {
  return (
    <header className="h-14 bg-bg-surface border-b border-border flex items-center justify-between px-6">
      {/* Episode selector */}
      <div className="flex items-center gap-3">
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-bg-elevated border border-border hover:border-text-muted transition-colors text-sm">
          <span className="font-display text-lg text-accent">EP 01</span>
          <span className="text-text-secondary">—</span>
          <span className="text-text-primary">Select Episode</span>
          <ChevronDown size={14} className="text-text-muted" />
        </button>

        {/* Status badge placeholder */}
        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium uppercase tracking-wider bg-bg-elevated text-text-muted border border-border">
          No episode
        </span>
      </div>

      {/* New episode button */}
      <button className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors">
        <Plus size={16} />
        <span>New Episode</span>
      </button>
    </header>
  );
}
