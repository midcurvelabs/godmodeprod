"use client";

import { useState } from "react";
import { Sparkles, Save } from "lucide-react";

interface CaptionEditorProps {
  captionText: string | null;
  onChange: (text: string) => void;
  onSave: () => void;
  readOnly?: boolean;
}

export function CaptionEditor({ captionText, onChange, onSave, readOnly = false }: CaptionEditorProps) {
  const [editing, setEditing] = useState(false);

  if (!captionText && readOnly) {
    return (
      <div className="text-xs text-text-muted italic py-2">
        No captions yet — process the clip to generate them.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
            Captions
          </span>
          {captionText && !editing && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-accent/10 text-accent">
              <Sparkles size={8} /> Auto
            </span>
          )}
        </div>
        {editing && (
          <button
            onClick={() => {
              onSave();
              setEditing(false);
            }}
            className="flex items-center gap-1 px-2 py-1 rounded bg-accent hover:bg-accent-hover text-white text-[11px] font-medium transition-colors"
          >
            <Save size={10} /> Save
          </button>
        )}
      </div>

      <textarea
        value={captionText || ""}
        onChange={(e) => {
          onChange(e.target.value);
          if (!editing) setEditing(true);
        }}
        readOnly={readOnly}
        rows={4}
        placeholder="Caption text will appear here after processing..."
        className={`w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none resize-none focus:border-accent/50 transition-colors ${
          readOnly ? "opacity-60 cursor-not-allowed" : ""
        }`}
      />
    </div>
  );
}
