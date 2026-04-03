"use client";

import { CheckCircle2, Circle } from "lucide-react";

export type PipelineStep = "upload" | "ingest" | "analyze" | "write" | "done";

const STEPS: { key: PipelineStep; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "ingest", label: "Ingest" },
  { key: "analyze", label: "Analyze" },
  { key: "write", label: "Write" },
  { key: "done", label: "Done" },
];

interface PipelineRailProps {
  currentStep: PipelineStep;
}

export function PipelineRail({ currentStep }: PipelineRailProps) {
  const stepIndex = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center gap-1 bg-bg-surface border border-border rounded-lg px-4 py-3">
      {STEPS.map((step, i) => {
        const isDone = i < stepIndex || currentStep === "done";
        const isActive = i === stepIndex && currentStep !== "done";

        return (
          <div key={step.key} className="flex items-center gap-1 flex-1">
            <div className="flex items-center gap-1.5">
              {isDone ? (
                <CheckCircle2 size={16} className="text-success" />
              ) : isActive ? (
                <div className="w-4 h-4 rounded-full border-2 border-accent bg-accent/20" />
              ) : (
                <Circle size={16} className="text-text-muted" />
              )}
              <span
                className={`text-xs font-medium ${
                  isDone ? "text-success" : isActive ? "text-accent" : "text-text-muted"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-2 ${isDone ? "bg-success/50" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function getPipelineStep(
  hasTranscript: boolean,
  transcriptStatus: string | null,
  hasMaster: boolean,
  hasOutputs: boolean
): PipelineStep {
  if (!hasTranscript) return "upload";
  if (transcriptStatus === "pending") return "ingest";
  if (transcriptStatus === "processed" && !hasMaster) return "analyze";
  if (hasMaster && !hasOutputs) return "write";
  if (hasOutputs) return "done";
  return "analyze";
}
