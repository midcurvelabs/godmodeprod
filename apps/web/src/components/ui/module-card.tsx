import { StatusPill } from "./status-pill";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ModuleCardProps {
  name: string;
  description: string;
  status: "done" | "live" | "in_progress" | "planned" | "blocked" | "error";
  statusLabel?: string;
  icon: LucideIcon;
  lastAction?: string;
  onClick?: () => void;
}

export function ModuleCard({
  name,
  description,
  status,
  statusLabel,
  icon: Icon,
  lastAction,
  onClick,
}: ModuleCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-bg-surface border border-border rounded-lg p-4 hover:border-text-muted transition-colors group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon size={16} strokeWidth={1.5} className="text-text-secondary" />
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-secondary">
            {name}
          </span>
        </div>
        <StatusPill status={status} label={statusLabel} />
      </div>

      <p className="text-sm text-text-secondary mb-3 line-clamp-2">
        {description}
      </p>

      <div className="flex items-center justify-between">
        {lastAction && (
          <span className="text-xs text-text-muted">{lastAction}</span>
        )}
        <ChevronRight
          size={14}
          className="text-text-muted group-hover:text-text-secondary transition-colors ml-auto"
        />
      </div>
    </button>
  );
}
