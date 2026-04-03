"use client";

import { Loader2, Upload, RefreshCw } from "lucide-react";

interface ProgressViewProps {
  state: "empty" | "processing" | "analyzing" | "generating" | "ready";
  transcriptStatus?: string | null;
  hasMaster?: boolean;
  hasOutputs?: boolean;
}

const ANALYZE_STEPS = [
  "Tagging moments by host...",
  "Identifying strong hooks...",
  "Extracting clip timestamps...",
  "Building master repurpose doc...",
];

const GENERATE_STEPS = [
  "Writing shorts captions...",
  "Crafting Twitter threads...",
  "Building LinkedIn posts...",
  "Creating YouTube segments & schedule...",
];

export function ProgressView({ state, transcriptStatus, hasMaster, hasOutputs }: ProgressViewProps) {
  if (state === "empty") {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted">
        <div className="text-center">
          <Upload size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm mb-1">No transcript uploaded yet.</p>
          <p className="text-[11px]">Paste or drop your recording transcript on the left to get started.</p>
        </div>
      </div>
    );
  }

  if (state === "processing") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-accent mx-auto mb-3" />
          <p className="text-sm text-text-secondary mb-1">Processing transcript...</p>
          <p className="text-[11px] text-text-muted">Cleaning, tagging speakers, and normalizing formatting.</p>
        </div>
      </div>
    );
  }

  if (state === "analyzing") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-xs">
          <Loader2 size={32} className="animate-spin text-accent mx-auto mb-4" />
          <p className="text-sm text-text-secondary mb-3">Analyzing transcript...</p>
          <div className="space-y-2">
            {ANALYZE_STEPS.map((step, i) => (
              <p key={i} className="text-[11px] text-text-muted animate-pulse" style={{ animationDelay: `${i * 0.5}s` }}>
                {step}
              </p>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (state === "generating") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-xs">
          <Loader2 size={32} className="animate-spin text-accent mx-auto mb-4" />
          <p className="text-sm text-text-secondary mb-3">Generating content...</p>
          <div className="space-y-2">
            {GENERATE_STEPS.map((step, i) => (
              <p key={i} className="text-[11px] text-text-muted animate-pulse" style={{ animationDelay: `${i * 0.5}s` }}>
                {step}
              </p>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Ready state
  return (
    <div className="flex-1 flex items-center justify-center text-text-muted">
      <div className="text-center">
        <RefreshCw size={32} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm mb-1">
          {transcriptStatus === "processed" && !hasMaster
            ? "Ready to analyze."
            : hasMaster && !hasOutputs
              ? "Analysis complete. Ready to generate content."
              : "Waiting for data..."}
        </p>
        <p className="text-[11px]">Use the controls on the left to proceed.</p>
      </div>
    </div>
  );
}
