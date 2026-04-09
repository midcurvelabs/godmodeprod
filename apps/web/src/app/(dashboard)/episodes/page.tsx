"use client";

import { useRouter } from "next/navigation";
import {
  ListTodo,
  BookOpen,
  FileText,
  Repeat,
  Newspaper,
  Rocket,
  Plus,
} from "lucide-react";
import { ModuleCard } from "@/components/ui/module-card";
import { ProgressRail } from "@/components/ui/progress-rail";
import { ActivityFeed } from "@/components/ui/activity-feed";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import { NewEpisodeModal } from "@/components/ui/new-episode-modal";
import { useState } from "react";
import type { EpisodeStatus } from "@godmodeprod/shared";

const MODULES = [
  {
    name: "Docket",
    description: "Capture, review, and vote on topics for the upcoming episode.",
    icon: ListTodo,
    href: "/docket",
    phase: "pre",
    readyAt: ["docket_open", "docket_locked"] as EpisodeStatus[],
  },
  {
    name: "Research Brief",
    description: "Generate pre-show research with depth per confirmed topic.",
    icon: BookOpen,
    href: "/research",
    phase: "pre",
    readyAt: ["docket_locked", "research_running", "research_ready"] as EpisodeStatus[],
  },
  {
    name: "Runsheet",
    description: "Timestamped production document for the live recording.",
    icon: FileText,
    href: "/runsheet",
    phase: "pre",
    readyAt: ["research_ready", "runsheet_ready"] as EpisodeStatus[],
  },
  {
    name: "Repurpose Engine",
    description: "Transform transcript into content for every platform.",
    icon: Repeat,
    href: "/repurpose",
    phase: "post",
    readyAt: ["transcript_received", "repurpose_running", "content_ready"] as EpisodeStatus[],
  },
  {
    name: "Newsletter",
    description: "Generate ready-to-paste Substack post from the episode.",
    icon: Newspaper,
    href: "/newsletter",
    phase: "post",
    readyAt: ["content_ready", "video_ready", "delivered"] as EpisodeStatus[],
  },
];

function getModuleStatus(module: typeof MODULES[number], episodeStatus: EpisodeStatus | null) {
  if (!episodeStatus) return "planned" as const;
  const allStatuses: EpisodeStatus[] = [
    "created", "docket_open", "docket_locked", "research_running",
    "research_ready", "runsheet_ready", "recording", "transcript_received",
    "repurpose_running", "content_ready", "video_processing", "video_ready",
    "delivered", "posted",
  ];
  const current = allStatuses.indexOf(episodeStatus);
  const moduleEnd = Math.max(...module.readyAt.map((s) => allStatuses.indexOf(s)));
  const moduleStart = Math.min(...module.readyAt.map((s) => allStatuses.indexOf(s)));

  if (current > moduleEnd) return "done" as const;
  if (current >= moduleStart) return "in_progress" as const;
  return "planned" as const;
}

export default function EpisodesPage() {
  const router = useRouter();
  const { currentShow, currentEpisode } = useEpisodeStore();
  const [showModal, setShowModal] = useState(false);

  // Empty state
  if (!currentEpisode) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Rocket size={48} strokeWidth={1} className="text-text-muted mb-4" />
        <h1 className="font-display text-4xl text-accent mb-2">
          START YOUR FIRST EPISODE
        </h1>
        <p className="text-text-secondary text-sm mb-6 max-w-md">
          Create an episode to begin your production pipeline. Each episode
          flows through pre-production, recording, and post-production.
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white font-medium transition-colors"
        >
          <Plus size={18} />
          New Episode
        </button>
        {showModal && <NewEpisodeModal onClose={() => setShowModal(false)} />}
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Episode header */}
        <div className="mb-6">
          <div className="flex items-baseline gap-3 mb-1">
            <h1 className="font-display text-5xl text-accent">
              EP {String(currentEpisode.episode_number).padStart(2, "0")}
            </h1>
            <h2 className="text-xl font-semibold text-text-primary truncate">
              {currentEpisode.title}
            </h2>
          </div>
          <div className="flex items-center gap-3 text-sm text-text-secondary">
            {currentEpisode.recording_date && (
              <span>
                Recording:{" "}
                {new Date(currentEpisode.recording_date).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium uppercase tracking-wider bg-bg-elevated text-text-secondary border border-border">
              {currentEpisode.status.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        {/* Phase rail */}
        <div className="mb-6">
          <ProgressRail status={currentEpisode.status} />
        </div>

        {/* Module grid */}
        <div className="grid grid-cols-2 gap-4">
          {MODULES.map((module) => (
            <ModuleCard
              key={module.name}
              name={module.name}
              description={module.description}
              status={getModuleStatus(module, currentEpisode.status)}
              icon={module.icon}
              onClick={() => router.push(module.href)}
            />
          ))}
        </div>
      </div>

      {/* Activity feed right panel */}
      {currentShow && (
        <div className="w-[320px] shrink-0">
          <div className="sticky top-20">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted mb-3">
              Activity Feed
            </h3>
            <div className="bg-bg-surface border border-border rounded-lg p-3 max-h-[calc(100vh-180px)] overflow-y-auto">
              <ActivityFeed
                showId={currentShow.id}
                episodeId={currentEpisode.id}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
