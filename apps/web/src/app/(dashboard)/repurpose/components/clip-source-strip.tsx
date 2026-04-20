"use client";

import { ExternalLink } from "lucide-react";

export type LayoutChoice = "clip_only" | "broll" | "split_screen" | null;

export interface ClipSourceStripProps {
  sourceUrl: string | null;
  sourceImageUrl: string | null;
  sourceTitle: string | null;
  layoutChoice: LayoutChoice;
  onLayoutChange: (next: LayoutChoice) => void;
}

function getHostname(url: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const PILL_BASE =
  "px-2 py-0.5 rounded text-[10px] font-medium border transition-colors";
const PILL_ACTIVE = "bg-accent/15 text-accent border-accent/40";
const PILL_IDLE = "bg-bg-elevated text-text-muted border-border hover:text-text-secondary";
const PILL_DISABLED = "bg-bg-elevated text-text-muted/40 border-border cursor-not-allowed";

export function ClipSourceStrip({
  sourceUrl,
  sourceImageUrl,
  sourceTitle,
  layoutChoice,
  onLayoutChange,
}: ClipSourceStripProps) {
  const hasSource = Boolean(sourceUrl);
  const effectiveChoice: LayoutChoice = layoutChoice ?? "clip_only";
  const domain = getHostname(sourceUrl);

  return (
    <div className="mt-2 pt-2 border-t border-border space-y-2">
      {hasSource && sourceUrl ? (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 hover:bg-bg-elevated rounded px-1 py-1 transition-colors"
        >
          {sourceImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sourceImageUrl}
              alt=""
              className="w-10 h-10 rounded object-cover shrink-0 bg-bg-elevated"
            />
          ) : (
            <div className="w-10 h-10 rounded bg-bg-elevated shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-text-muted truncate">{domain}</div>
            {sourceTitle ? (
              <div className="text-[11px] text-text-secondary truncate">
                {sourceTitle}
              </div>
            ) : null}
          </div>
          <ExternalLink size={12} className="text-text-muted shrink-0" />
        </a>
      ) : null}

      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-text-muted uppercase tracking-wider mr-1">
          Layout
        </span>
        <button
          type="button"
          onClick={() => onLayoutChange("clip_only")}
          className={`${PILL_BASE} ${
            effectiveChoice === "clip_only" ? PILL_ACTIVE : PILL_IDLE
          }`}
        >
          Clip only
        </button>
        <button
          type="button"
          disabled={!hasSource}
          title={hasSource ? "" : "No source asset for this clip"}
          onClick={() => hasSource && onLayoutChange("broll")}
          className={`${PILL_BASE} ${
            !hasSource
              ? PILL_DISABLED
              : effectiveChoice === "broll"
              ? PILL_ACTIVE
              : PILL_IDLE
          }`}
        >
          + B-roll
        </button>
        <button
          type="button"
          disabled={!hasSource}
          title={hasSource ? "" : "No source asset for this clip"}
          onClick={() => hasSource && onLayoutChange("split_screen")}
          className={`${PILL_BASE} ${
            !hasSource
              ? PILL_DISABLED
              : effectiveChoice === "split_screen"
              ? PILL_ACTIVE
              : PILL_IDLE
          }`}
        >
          Split-screen
        </button>
      </div>
    </div>
  );
}
