"use client";

interface TextFieldsProps {
  episodeNumber: number;
  subtitle: string;
  onSubtitleChange: (value: string) => void;
}

export function TextFields({ episodeNumber, subtitle, onSubtitleChange }: TextFieldsProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted block mb-1">
          Episode Number
        </label>
        <div className="bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-text-secondary">
          EP. {String(episodeNumber).padStart(2, "0")}
        </div>
      </div>
      <div>
        <label className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted block mb-1">
          Headline
        </label>
        <input
          type="text"
          value={subtitle}
          onChange={(e) => onSubtitleChange(e.target.value)}
          placeholder="Your main headline here..."
          className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 transition-colors"
        />
        <span className="text-[10px] text-text-muted mt-0.5 block">
          {subtitle.length}/60 characters
        </span>
      </div>
    </div>
  );
}
