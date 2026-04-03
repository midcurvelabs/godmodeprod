"use client";

import { Film, Download, Send } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";

interface OutputCardProps {
  clip: {
    id: string;
    title: string;
    start_time: number;
    end_time: number;
    status: string;
    output_url: string | null;
    format: string;
  };
  hostName: string;
  onDownload: (clipId: string) => void;
  onSendTelegram: (clipId: string) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function OutputCard({ clip, hostName, onDownload, onSendTelegram }: OutputCardProps) {
  const duration = clip.end_time - clip.start_time;

  return (
    <div className="bg-bg-elevated border border-border rounded-lg p-3">
      {/* Thumbnail placeholder */}
      <div className="aspect-[9/16] max-h-32 bg-bg-primary rounded flex items-center justify-center mb-2">
        <Film size={20} className="text-text-muted" />
      </div>

      <p className="text-sm text-text-primary truncate mb-0.5">{clip.title}</p>
      <div className="flex items-center gap-2 text-[11px] text-text-muted mb-2">
        {hostName && <span>{hostName}</span>}
        <span>{formatTime(duration)}</span>
        <span>{clip.format}</span>
      </div>

      <StatusPill status={clip.status === "done" ? "done" : "error"} label={clip.status} />

      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={() => onDownload(clip.id)}
          disabled={!clip.output_url}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-bg-surface border border-border text-xs text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
        >
          <Download size={12} /> Download
        </button>
        <button
          onClick={() => onSendTelegram(clip.id)}
          className="flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-bg-surface border border-border text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}
