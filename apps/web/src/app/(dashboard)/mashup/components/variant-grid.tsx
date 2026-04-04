"use client";

import { Download, Loader2, CheckCircle, Clock, XCircle } from "lucide-react";

interface MashupOutput {
  id: string;
  variant: string;
  status: string;
  output_url: string | null;
}

interface VariantGridProps {
  outputs: MashupOutput[];
  onDownload: (id: string) => void;
}

const VARIANT_META: Record<string, { label: string; color: string }> = {
  standard: { label: "Standard", color: "text-blue-400" },
  reversed: { label: "Reversed", color: "text-purple-400" },
  theme_lead: { label: "Theme Lead", color: "text-amber-400" },
  flash: { label: "Flash", color: "text-red-400" },
  gaps: { label: "Gaps", color: "text-emerald-400" },
};

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
    case "done":
      return <CheckCircle className="w-4 h-4 text-success" />;
    case "processing":
    case "running":
      return <Loader2 className="w-4 h-4 text-warning animate-spin" />;
    case "failed":
      return <XCircle className="w-4 h-4 text-error" />;
    default:
      return <Clock className="w-4 h-4 text-text-muted" />;
  }
}

export function VariantGrid({ outputs, onDownload }: VariantGridProps) {
  if (outputs.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border">
          <span className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
            Output Variants
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center text-text-muted text-sm p-4 text-center">
          <div>
            <p>No mashups generated yet.</p>
            <p className="text-[11px] mt-1">Select clips and hit Generate.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
          Output Variants
        </span>
        <span className="text-[11px] text-text-muted ml-2">
          {outputs.filter((o) => o.status === "completed" || o.status === "done").length}/
          {outputs.length} ready
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {outputs.map((output) => {
          const meta = VARIANT_META[output.variant] || {
            label: output.variant,
            color: "text-text-primary",
          };
          const isDone = output.status === "completed" || output.status === "done";

          return (
            <div
              key={output.id}
              className="bg-bg-primary border border-border rounded p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${meta.color}`}>
                  {meta.label}
                </span>
                <StatusIcon status={output.status} />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-text-muted capitalize">
                  {output.status}
                </span>
                {isDone && output.output_url && (
                  <button
                    onClick={() => onDownload(output.id)}
                    className="flex items-center gap-1 text-[11px] text-accent hover:text-accent-hover"
                  >
                    <Download className="w-3 h-3" />
                    Download
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
