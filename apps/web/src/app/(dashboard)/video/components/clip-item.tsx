"use client";

import { StatusPill } from "@/components/ui/status-pill";

interface ClipItemProps {
  clip: {
    id: string;
    title: string;
    host_id: string | null;
    start_time: number;
    end_time: number;
    status: string;
  };
  hostName: string;
  selected: boolean;
  onSelect: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function clipStatusToPill(status: string): "done" | "in_progress" | "planned" | "error" {
  if (status === "done") return "done";
  if (status === "queued") return "planned";
  if (["cutting", "transcribing", "captioning", "compositing"].includes(status)) return "in_progress";
  return "error";
}

export function ClipItem({ clip, hostName, selected, onSelect }: ClipItemProps) {
  const duration = clip.end_time - clip.start_time;

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-3 py-2.5 border-l-2 transition-colors ${
        selected
          ? "border-l-accent bg-accent/5"
          : "border-l-transparent hover:bg-bg-elevated"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-text-primary truncate">{clip.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {hostName && (
              <span className="text-[11px] text-text-secondary">{hostName}</span>
            )}
            <span className="text-[11px] text-text-muted">
              {formatTime(clip.start_time)} – {formatTime(clip.end_time)} ({formatTime(duration)})
            </span>
          </div>
        </div>
        <StatusPill status={clipStatusToPill(clip.status)} label={clip.status} />
      </div>
    </button>
  );
}
