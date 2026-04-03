"use client";

import { CopyButton } from "./copy-button";
import { Sparkles, Calendar } from "lucide-react";

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: "bg-pink-500/15 text-pink-400 border-pink-500/20",
  instagram: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  youtube_shorts: "bg-red-500/15 text-red-400 border-red-500/20",
  youtube: "bg-red-500/15 text-red-400 border-red-500/20",
  twitter: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  linkedin: "bg-sky-500/15 text-sky-400 border-sky-500/20",
};

const DAY_LABELS = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"];

interface RepurposeOutput {
  id: string;
  output_type: string;
  content: Record<string, unknown>;
  host_id: string | null;
  status: string;
}

interface TabScheduleProps {
  outputs: RepurposeOutput[];
  onRegenerate: (outputType: string) => void;
}

export function TabSchedule({ outputs, onRegenerate }: TabScheduleProps) {
  const scheduleOutput = outputs.find((o) => o.output_type === "schedule");

  if (!scheduleOutput) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted">
        <p className="text-sm">No posting schedule generated yet.</p>
      </div>
    );
  }

  const schedule = scheduleOutput.content as Record<string, unknown>;
  const days = DAY_LABELS.map((label, i) => {
    const key = `day_${i + 1}`;
    const daysObj = schedule.days as Record<string, unknown> | undefined;
    const items = (schedule[key] || daysObj?.[key] || []) as Array<Record<string, unknown> | string>;
    return { label, items };
  });

  // Build CSV export
  function buildCSV(): string {
    const lines = ["Day,Platform,Content,Host,Time"];
    days.forEach((day) => {
      day.items.forEach((item) => {
        if (typeof item === "string") {
          lines.push(`${day.label},,${item},,`);
        } else {
          lines.push(`${day.label},${item.platform || ""},${item.content_type || item.clip_ref || ""},${item.host || ""},${item.time || ""}`);
        }
      });
    });
    return lines.join("\n");
  }

  const totalItems = days.reduce((sum, day) => sum + day.items.length, 0);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-3 border-b border-border flex items-center gap-2">
        <Calendar size={14} className="text-text-muted" />
        <span className="text-xs text-text-muted">7-day posting schedule &middot; {totalItems} items</span>
        <div className="flex-1" />
        <CopyButton text={buildCSV()} label="Copy CSV" size="sm" />
        <button
          onClick={() => onRegenerate("schedule")}
          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-text-muted hover:text-accent transition-colors"
        >
          <Sparkles size={11} /> Regenerate
        </button>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-7 gap-2">
          {days.map((day, di) => (
            <div key={di} className="min-h-[200px]">
              {/* Day Header */}
              <div className="text-center mb-2">
                <span className="text-xs font-medium text-text-muted uppercase">{day.label}</span>
                <div className="text-[10px] text-text-muted">{day.items.length} items</div>
              </div>

              {/* Items */}
              <div className="space-y-1.5">
                {day.items.map((item, ii) => {
                  if (typeof item === "string") {
                    return (
                      <div key={ii} className="bg-bg-elevated border border-border rounded px-2 py-1.5 text-[11px] text-text-secondary">
                        {item}
                      </div>
                    );
                  }

                  const platform = (item.platform as string) || "";
                  const colorClass = PLATFORM_COLORS[platform] || "bg-bg-elevated text-text-muted border-border";

                  return (
                    <div key={ii} className={`rounded px-2 py-1.5 border ${colorClass}`}>
                      <div className="text-[10px] font-medium uppercase mb-0.5">{platform.replace("_", " ")}</div>
                      <div className="text-[11px] leading-tight">
                        {(item.clip_ref || item.content_type) as string}
                      </div>
                      {item.host ? (
                        <div className="text-[10px] mt-0.5 opacity-75">{item.host as string}</div>
                      ) : null}
                      {item.time ? (
                        <div className="text-[10px] mt-0.5 opacity-60">{item.time as string}</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
