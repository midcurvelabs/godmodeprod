"use client";

import { Film, Play } from "lucide-react";
import { FormatSelector } from "./format-selector";
import { CaptionEditor } from "./caption-editor";

interface Clip {
  id: string;
  title: string;
  start_time: number;
  end_time: number;
  status: string;
  caption_text: string | null;
  format: string;
}

interface PreviewPanelProps {
  clip: Clip | null;
  format: string;
  onFormatChange: (format: string) => void;
  onCaptionChange: (text: string) => void;
  onSaveCaption: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const ASPECT_CLASSES: Record<string, string> = {
  "9:16": "aspect-[9/16] max-h-[50vh]",
  "1:1": "aspect-square max-h-[50vh]",
  "16:9": "aspect-video max-h-[50vh]",
};

export function PreviewPanel({ clip, format, onFormatChange, onCaptionChange, onSaveCaption }: PreviewPanelProps) {
  if (!clip) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-muted">
        <Film size={32} className="mb-3 opacity-40" />
        <p className="text-sm">Select a clip from the queue</p>
        <p className="text-xs mt-1">or import clips from repurpose analysis</p>
      </div>
    );
  }

  const duration = clip.end_time - clip.start_time;
  const isProcessing = ["cutting", "transcribing", "captioning", "compositing"].includes(clip.status);

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Title bar */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-primary truncate">{clip.title}</h3>
        <span className="text-xs text-text-muted shrink-0 ml-2">
          {formatTime(clip.start_time)} – {formatTime(clip.end_time)}
        </span>
      </div>

      {/* Video preview placeholder */}
      <div className="flex-shrink-0 flex justify-center">
        <div
          className={`${ASPECT_CLASSES[format] || ASPECT_CLASSES["9:16"]} w-auto bg-bg-primary rounded-lg flex flex-col items-center justify-center relative border border-border`}
        >
          <Play size={32} className="text-text-muted opacity-40" />
          <span className="text-[11px] text-text-muted mt-2">Video Preview</span>
          {/* Duration badge */}
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-[10px] text-white font-mono">
            {formatTime(duration)}
          </div>
        </div>
      </div>

      {/* Timeline placeholder */}
      <div>
        <div className="relative h-8 bg-bg-primary rounded border border-border overflow-hidden">
          {/* Waveform visual */}
          <div className="absolute inset-0 flex items-center justify-center gap-px px-2">
            {Array.from({ length: 60 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 bg-text-muted/30 rounded-full"
                style={{ height: `${20 + Math.random() * 60}%` }}
              />
            ))}
          </div>
          {/* Start/end markers */}
          <div className="absolute left-[5%] top-0 bottom-0 w-0.5 bg-accent" />
          <div className="absolute right-[5%] top-0 bottom-0 w-0.5 bg-accent" />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] font-mono text-text-muted">{formatTime(clip.start_time)}</span>
          <span className="text-[10px] font-mono text-text-muted">{formatTime(clip.end_time)}</span>
        </div>
      </div>

      {/* Format selector */}
      <FormatSelector value={format} onChange={onFormatChange} />

      {/* Caption editor */}
      <CaptionEditor
        captionText={clip.caption_text}
        onChange={onCaptionChange}
        onSave={onSaveCaption}
        readOnly={isProcessing}
      />
    </div>
  );
}
