"use client";

import { Loader2, Download, Send, ImageIcon } from "lucide-react";

interface ThumbnailOutput {
  id: string;
  output_url: string | null;
  status: string;
}

interface GenerateOutputProps {
  generating: boolean;
  output: ThumbnailOutput | null;
  onGenerate: () => void;
  onDownload: () => void;
  onSendTelegram: () => void;
  canGenerate: boolean;
}

export function GenerateOutput({
  generating,
  output,
  onGenerate,
  onDownload,
  onSendTelegram,
  canGenerate,
}: GenerateOutputProps) {
  return (
    <div className="space-y-4">
      <button
        onClick={onGenerate}
        disabled={!canGenerate || generating}
        className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg py-3 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {generating ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Generating...
          </>
        ) : (
          <>
            <ImageIcon size={16} /> Generate Thumbnail
          </>
        )}
      </button>

      {generating && (
        <div className="text-center space-y-1">
          <p className="text-xs text-text-secondary">Removing backgrounds from photos...</p>
          <p className="text-xs text-text-muted">Compositing final image...</p>
        </div>
      )}

      {output && output.status === "done" && (
        <div className="bg-bg-elevated border border-border rounded-lg p-4">
          <div className="aspect-video bg-bg-primary rounded mb-3 flex items-center justify-center border border-border overflow-hidden">
            {output.output_url ? (
              <img
                src={output.output_url}
                alt="Generated thumbnail"
                className="w-full h-full object-contain"
              />
            ) : (
              <ImageIcon size={32} className="text-text-muted" />
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onDownload}
              disabled={!output.output_url}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Download size={12} /> Download PNG
            </button>
            <button
              onClick={onSendTelegram}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-bg-surface border border-border text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              <Send size={12} /> Telegram
            </button>
          </div>
        </div>
      )}

      {output && output.status === "pending" && !generating && (
        <div className="text-center py-4">
          <Loader2 size={18} className="animate-spin text-accent mx-auto mb-1" />
          <p className="text-xs text-text-secondary">Processing thumbnail...</p>
        </div>
      )}
    </div>
  );
}
