"use client";

import { ArrowUp, ArrowDown } from "lucide-react";

interface Host {
  id: string;
  name: string;
}

interface ControlsPanelProps {
  hosts: Host[];
  hostOrder: string[];
  textSize: "small" | "medium" | "large";
  stripePosition: "top" | "middle" | "bottom";
  onHostOrderChange: (order: string[]) => void;
  onTextSizeChange: (size: "small" | "medium" | "large") => void;
  onStripePositionChange: (pos: "top" | "middle" | "bottom") => void;
}

function ToggleGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted block mb-1.5">
        {label}
      </span>
      <div className="flex gap-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
              value === opt.value
                ? "bg-accent/15 text-accent border border-accent/30"
                : "bg-bg-elevated text-text-secondary border border-border hover:text-text-primary"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ControlsPanel({
  hosts,
  hostOrder,
  textSize,
  stripePosition,
  onHostOrderChange,
  onTextSizeChange,
  onStripePositionChange,
}: ControlsPanelProps) {
  const hostMap = Object.fromEntries(hosts.map((h) => [h.id, h]));

  function moveHost(index: number, direction: -1 | 1) {
    const newOrder = [...hostOrder];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    onHostOrderChange(newOrder);
  }

  return (
    <div className="space-y-4">
      {/* Host order */}
      <div>
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted block mb-1.5">
          Host Order (L → R)
        </span>
        <div className="space-y-1">
          {hostOrder.map((id, i) => (
            <div key={id} className="flex items-center gap-2 bg-bg-elevated border border-border rounded px-2 py-1.5">
              <span className="text-xs text-text-primary flex-1">
                {hostMap[id]?.name || id}
              </span>
              <button
                onClick={() => moveHost(i, -1)}
                disabled={i === 0}
                className="text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
              >
                <ArrowUp size={12} />
              </button>
              <button
                onClick={() => moveHost(i, 1)}
                disabled={i === hostOrder.length - 1}
                className="text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
              >
                <ArrowDown size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <ToggleGroup
        label="Text Size"
        options={[
          { value: "small" as const, label: "S" },
          { value: "medium" as const, label: "M" },
          { value: "large" as const, label: "L" },
        ]}
        value={textSize}
        onChange={onTextSizeChange}
      />

      <ToggleGroup
        label="Red Stripe"
        options={[
          { value: "top" as const, label: "Top" },
          { value: "middle" as const, label: "Middle" },
          { value: "bottom" as const, label: "Bottom" },
        ]}
        value={stripePosition}
        onChange={onStripePositionChange}
      />
    </div>
  );
}
