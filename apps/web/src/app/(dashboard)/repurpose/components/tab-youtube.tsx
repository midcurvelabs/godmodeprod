"use client";

import { useState } from "react";
import { CopyButton } from "./copy-button";
import { Film, Sparkles } from "lucide-react";

interface RepurposeOutput {
  id: string;
  output_type: string;
  content: Record<string, unknown>;
  host_id: string | null;
  status: string;
}

interface TabYouTubeProps {
  outputs: RepurposeOutput[];
  onRegenerate: (outputType: string) => void;
}

export function TabYouTube({ outputs, onRegenerate }: TabYouTubeProps) {
  const [selectedTitles, setSelectedTitles] = useState<Record<number, number>>({});

  const ytOutput = outputs.find((o) => o.output_type === "youtube_segments");

  if (!ytOutput) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted">
        <p className="text-sm">No YouTube segments generated yet.</p>
      </div>
    );
  }

  const segments = (ytOutput.content.segments || []) as Array<Record<string, unknown>>;

  function buildYouTubeDescription(): string {
    return segments
      .map((seg, i) => {
        const titleIndex = selectedTitles[i] || 0;
        const titles = (seg.title_options || []) as string[];
        const title = titles[titleIndex] || (seg.title as string) || `Segment ${i + 1}`;
        const desc = (seg.description as string) || "";
        const chapters = (seg.chapters || []) as Array<{ timestamp: string; title: string }>;
        const chaptersStr = chapters.map((c) => `${c.timestamp} ${c.title}`).join("\n");
        return `${title}\n${desc}\n\nChapters:\n${chaptersStr}`;
      })
      .join("\n\n---\n\n");
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-3 border-b border-border flex items-center gap-2">
        <span className="text-xs text-text-muted">{segments.length} segment(s) &middot; 5-15 min long-form cuts</span>
        <div className="flex-1" />
        <CopyButton text={buildYouTubeDescription()} label="Copy All as Description" size="sm" />
        <button
          onClick={() => onRegenerate("youtube_segments")}
          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-text-muted hover:text-accent transition-colors"
        >
          <Sparkles size={11} /> Regenerate
        </button>
      </div>

      <div className="p-6 space-y-6">
        {segments.map((seg, i) => {
          const titleOptions = (seg.title_options || []) as string[];
          const selectedTitle = selectedTitles[i] || 0;
          const description = (seg.description as string) || "";
          const chapters = (seg.chapters || []) as Array<{ timestamp: string; title: string }>;
          const thumbnail = seg.thumbnail_direction as Record<string, string> | undefined;
          const duration = (seg.estimated_duration_minutes as number) || 0;

          return (
            <div key={i} className="border border-border rounded-lg overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Film size={16} className="text-accent" />
                  <span className="text-sm font-medium text-text-primary">Segment {i + 1}</span>
                  <span className="text-[11px] text-text-muted">~{duration} min</span>
                  <span className="text-[11px] text-text-muted">{seg.start_ref as string} — {seg.end_ref as string}</span>
                </div>

                {/* Title Options */}
                {titleOptions.length > 0 && (
                  <div className="space-y-1.5">
                    <h5 className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted">Title Options</h5>
                    {titleOptions.map((title, ti) => (
                      <label key={ti} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                        selectedTitle === ti ? "bg-accent/10 border border-accent/30" : "hover:bg-bg-elevated border border-transparent"
                      }`}>
                        <input
                          type="radio"
                          name={`segment-title-${i}`}
                          checked={selectedTitle === ti}
                          onChange={() => setSelectedTitles((prev) => ({ ...prev, [i]: ti }))}
                          className="accent-accent"
                        />
                        <span className="text-sm text-text-primary">{title}</span>
                        <CopyButton text={title} label="" size="sm" className="ml-auto" />
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted">Description</h5>
                  <CopyButton text={description} label="Copy" size="sm" />
                </div>
                <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{description}</p>
              </div>

              {/* Chapters */}
              {chapters.length > 0 && (
                <div className="p-4 border-b border-border">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted">Chapters</h5>
                    <CopyButton
                      text={chapters.map((c) => `${c.timestamp} ${c.title}`).join("\n")}
                      label="Copy"
                      size="sm"
                    />
                  </div>
                  <div className="space-y-1">
                    {chapters.map((ch, ci) => (
                      <div key={ci} className="flex items-center gap-2 text-sm">
                        <span className="text-accent font-mono text-[12px]">{ch.timestamp}</span>
                        <span className="text-text-secondary">{ch.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Thumbnail Direction */}
              {thumbnail && (
                <div className="p-4">
                  <h5 className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted mb-2">Thumbnail Direction</h5>
                  <div className="flex gap-3 text-sm text-text-secondary">
                    <span>Host: <strong className="text-text-primary">{thumbnail.host}</strong></span>
                    <span>Expression: <strong className="text-text-primary">{thumbnail.expression}</strong></span>
                  </div>
                  {thumbnail.text_overlay && (
                    <p className="text-sm text-accent mt-1">Text: &ldquo;{thumbnail.text_overlay}&rdquo;</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
