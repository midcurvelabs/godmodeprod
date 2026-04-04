"use client";

import { CheckSquare, Square, Film } from "lucide-react";

interface Clip {
  id: string;
  title: string;
  host_id: string | null;
  start_time: number;
  end_time: number;
  status: string;
}

interface ClipSelectorProps {
  clips: Clip[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  loading: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ClipSelector({
  clips,
  selectedIds,
  onToggle,
  onSelectAll,
  onClearAll,
  loading,
}: ClipSelectorProps) {
  const doneClips = clips.filter((c) => c.status === "done" || c.status === "queued" || c.status === "completed");

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
            Select Clips
          </span>
          <span className="text-[11px] text-text-muted">
            {selectedIds.length} selected
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onSelectAll}
            className="text-[11px] text-accent hover:text-accent-hover"
          >
            Select all
          </button>
          <span className="text-text-muted">|</span>
          <button
            onClick={onClearAll}
            className="text-[11px] text-text-secondary hover:text-text-primary"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading ? (
          <div className="text-center py-8 text-text-muted text-sm">
            Loading clips...
          </div>
        ) : doneClips.length === 0 ? (
          <div className="text-center py-8 text-text-muted text-sm">
            <Film className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No clips available.</p>
            <p className="text-[11px] mt-1">Process clips in the Video Pipeline first.</p>
          </div>
        ) : (
          doneClips.map((clip) => {
            const selected = selectedIds.includes(clip.id);
            return (
              <button
                key={clip.id}
                onClick={() => onToggle(clip.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded text-left transition-colors ${
                  selected
                    ? "bg-accent/10 border border-accent/30"
                    : "hover:bg-bg-elevated border border-transparent"
                }`}
              >
                {selected ? (
                  <CheckSquare className="w-4 h-4 text-accent flex-shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-text-muted flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">
                    {clip.title}
                  </p>
                  <p className="text-[11px] text-text-muted">
                    {formatTime(clip.start_time)} – {formatTime(clip.end_time)}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
