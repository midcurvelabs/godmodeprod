"use client";

const FORMATS = [
  { value: "9:16", label: "9:16", width: 9, height: 16 },
  { value: "1:1", label: "1:1", width: 12, height: 12 },
  { value: "16:9", label: "16:9", width: 16, height: 9 },
] as const;

interface FormatSelectorProps {
  value: string;
  onChange: (format: string) => void;
}

export function FormatSelector({ value, onChange }: FormatSelectorProps) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted mr-2">
        Format
      </span>
      {FORMATS.map((f) => (
        <button
          key={f.value}
          onClick={() => onChange(f.value)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
            value === f.value
              ? "bg-accent/15 text-accent border border-accent/30"
              : "bg-bg-elevated text-text-secondary border border-border hover:text-text-primary"
          }`}
        >
          <div
            className={`border ${value === f.value ? "border-accent" : "border-text-muted"}`}
            style={{ width: f.width, height: f.height }}
          />
          {f.label}
        </button>
      ))}
    </div>
  );
}
