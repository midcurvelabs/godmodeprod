"use client";

import { useState } from "react";
import { Film, Upload, Loader2, CheckCircle2 } from "lucide-react";

interface SourceVideo {
  id: string;
  file_url: string;
  duration_seconds: number | null;
  format: string;
}

interface SourceUploadBarProps {
  sourceVideo: SourceVideo | null;
  onUpload: (url: string, duration?: number) => void;
  uploading: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SourceUploadBar({ sourceVideo, onUpload, uploading }: SourceUploadBarProps) {
  const [url, setUrl] = useState("");

  if (sourceVideo) {
    return (
      <div className="flex items-center gap-3 bg-bg-surface border border-border rounded-lg px-4 py-3">
        <Film size={16} className="text-accent shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm text-text-primary truncate block">
            {sourceVideo.file_url.split("/").pop() || "Source Video"}
          </span>
        </div>
        {sourceVideo.duration_seconds && (
          <span className="text-xs text-text-muted">
            {formatDuration(sourceVideo.duration_seconds)}
          </span>
        )}
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase bg-success/15 text-success border border-success/30">
          <CheckCircle2 size={10} /> Ready
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-bg-surface border border-border rounded-lg px-4 py-3">
      <Film size={16} className="text-text-muted shrink-0" />
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste source video URL (MP4)..."
        className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
      />
      <button
        onClick={() => {
          if (url.trim()) {
            onUpload(url.trim());
            setUrl("");
          }
        }}
        disabled={!url.trim() || uploading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Upload size={12} />
        )}
        {uploading ? "Uploading..." : "Upload"}
      </button>
    </div>
  );
}
