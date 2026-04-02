const STATUS_STYLES = {
  done: "bg-success/15 text-success border-success/30",
  live: "bg-success/15 text-success border-success/30",
  in_progress: "bg-warning/15 text-warning border-warning/30",
  planned: "bg-bg-elevated text-text-muted border-border",
  blocked: "bg-error/15 text-error border-error/30",
  error: "bg-error/15 text-error border-error/30",
} as const;

type StatusType = keyof typeof STATUS_STYLES;

interface StatusPillProps {
  status: StatusType;
  label?: string;
}

export function StatusPill({ status, label }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium uppercase tracking-wider border ${STATUS_STYLES[status]}`}
    >
      {label || status.replace("_", " ")}
    </span>
  );
}
