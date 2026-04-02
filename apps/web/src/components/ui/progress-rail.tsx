"use client";

import type { EpisodeStatus } from "@godmodeprod/shared";

const PHASES = [
  {
    label: "Pre-Production",
    statuses: [
      "created",
      "docket_open",
      "docket_locked",
      "research_running",
      "research_ready",
      "runsheet_ready",
    ] as EpisodeStatus[],
  },
  {
    label: "Recording",
    statuses: ["recording"] as EpisodeStatus[],
  },
  {
    label: "Post-Production",
    statuses: [
      "transcript_received",
      "repurpose_running",
      "content_ready",
      "video_processing",
      "video_ready",
      "delivered",
      "posted",
    ] as EpisodeStatus[],
  },
];

const ALL_STATUSES: EpisodeStatus[] = PHASES.flatMap((p) => p.statuses);

function getPhaseProgress(currentStatus: EpisodeStatus, phase: typeof PHASES[number]) {
  const globalIndex = ALL_STATUSES.indexOf(currentStatus);
  const phaseStart = ALL_STATUSES.indexOf(phase.statuses[0]);
  const phaseEnd = ALL_STATUSES.indexOf(phase.statuses[phase.statuses.length - 1]);

  if (globalIndex < phaseStart) return 0;
  if (globalIndex > phaseEnd) return 100;
  return Math.round(((globalIndex - phaseStart + 1) / phase.statuses.length) * 100);
}

export function ProgressRail({ status }: { status: EpisodeStatus }) {
  return (
    <div className="bg-bg-surface border border-border rounded-lg p-4">
      <div className="flex items-center gap-4">
        {PHASES.map((phase, i) => {
          const progress = getPhaseProgress(status, phase);
          return (
            <div key={phase.label} className="flex items-center gap-4 flex-1">
              {i > 0 && <div className="w-px h-4 bg-border" />}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                    {phase.label}
                  </span>
                  {progress > 0 && (
                    <span className="text-[11px] font-mono text-text-secondary">
                      {progress}%
                    </span>
                  )}
                </div>
                <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
