"use client";

import { Music, Wand2 } from "lucide-react";

interface MusicConfigProps {
  musicUrl: string;
  onMusicUrlChange: (url: string) => void;
  transitionStyle: string;
  onTransitionStyleChange: (style: string) => void;
  selectedCount: number;
  onGenerate: () => void;
  generating: boolean;
}

const TRANSITION_STYLES = [
  { value: "cut", label: "Hard Cut", desc: "Direct jump between clips" },
  { value: "crossfade", label: "Crossfade", desc: "Smooth blend transition" },
  { value: "beat-sync", label: "Beat Sync", desc: "Cut on music beats" },
];

export function MusicConfig({
  musicUrl,
  onMusicUrlChange,
  transitionStyle,
  onTransitionStyleChange,
  selectedCount,
  onGenerate,
  generating,
}: MusicConfigProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
          Configuration
        </span>
      </div>

      <div className="flex-1 p-4 space-y-6">
        {/* Theme Music */}
        <div>
          <label className="text-[11px] font-medium uppercase tracking-wider text-text-secondary block mb-2">
            Theme Music URL
          </label>
          <div className="relative">
            <Music className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="url"
              value={musicUrl}
              onChange={(e) => onMusicUrlChange(e.target.value)}
              placeholder="https://... (.mp3 or .wav)"
              className="w-full bg-bg-primary border border-border rounded px-3 py-2 pl-9 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>
          <p className="text-[11px] text-text-muted mt-1">
            Optional. Audio ducked under speech automatically.
          </p>
        </div>

        {/* Transition Style */}
        <div>
          <label className="text-[11px] font-medium uppercase tracking-wider text-text-secondary block mb-2">
            Transition Style
          </label>
          <div className="space-y-2">
            {TRANSITION_STYLES.map((t) => (
              <button
                key={t.value}
                onClick={() => onTransitionStyleChange(t.value)}
                className={`w-full flex items-start gap-3 px-3 py-2 rounded text-left transition-colors ${
                  transitionStyle === t.value
                    ? "bg-accent/10 border border-accent/30"
                    : "bg-bg-primary border border-border hover:border-text-muted"
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full border-2 mt-0.5 flex-shrink-0 ${
                    transitionStyle === t.value
                      ? "border-accent bg-accent"
                      : "border-text-muted"
                  }`}
                />
                <div>
                  <p className="text-sm text-text-primary">{t.label}</p>
                  <p className="text-[11px] text-text-muted">{t.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Variant Info */}
        <div className="bg-bg-primary border border-border rounded p-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-text-secondary mb-2">
            Output Variants
          </p>
          <div className="space-y-1 text-sm text-text-secondary">
            <p><span className="text-text-primary">Standard</span> — clips in order</p>
            <p><span className="text-text-primary">Reversed</span> — strongest take first</p>
            <p><span className="text-text-primary">Theme Lead</span> — music intro, then clips</p>
            <p><span className="text-text-primary">Flash</span> — rapid 2-sec cuts</p>
            <p><span className="text-text-primary">Gaps</span> — dramatic pauses between takes</p>
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <div className="p-4 border-t border-border">
        <button
          onClick={onGenerate}
          disabled={selectedCount === 0 || generating}
          className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded transition-colors"
        >
          <Wand2 className="w-4 h-4" />
          {generating
            ? "Generating 5 variants..."
            : `Generate Mashups (${selectedCount} clip${selectedCount !== 1 ? "s" : ""})`}
        </button>
      </div>
    </div>
  );
}
