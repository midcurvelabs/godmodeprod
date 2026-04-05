"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Copy,
  RefreshCw,
  Printer,
  Download,
  Loader2,
  Mic,
  MessageSquare,
  HelpCircle,
  Swords,
  GripVertical,
} from "lucide-react";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import { useJobPoll } from "@/lib/hooks/use-job-poll";
import type { Runsheet } from "@godmodeprod/shared";

interface RunsheetSegment {
  name: string;
  time_label: string;
  duration_minutes: number;
  rik_intro: string;
  seed_points: Array<{ host: string; points: string[] }>;
  tight_questions: string[];
  debate_positions: Array<{ host: string; position: string }>;
}

const DEFAULT_SEGMENTS = [
  { name: "Coordinates", time_label: "0:00–3:00", duration_minutes: 3 },
  { name: "Boot Sequence", time_label: "3:00–5:00", duration_minutes: 2 },
  { name: "The Signal", time_label: "5:00–15:00", duration_minutes: 10 },
  { name: "God Mode Takes", time_label: "15:00–45:00", duration_minutes: 30 },
  { name: "Rapid Fire", time_label: "45:00–55:00", duration_minutes: 10 },
  { name: "The Close", time_label: "55:00–60:00", duration_minutes: 5 },
];

export default function RunsheetPage() {
  const { currentShow, currentEpisode } = useEpisodeStore();
  const [runsheet, setRunsheet] = useState<Runsheet | null>(null);
  const [activeSegment, setActiveSegment] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [printView, setPrintView] = useState(false);

  const { status: jobStatus } = useJobPoll({
    jobId: pollingJobId,
    enabled: generating,
    onComplete: async () => {
      await fetchRunsheet();
      setGenerating(false);
      setPollingJobId(null);
    },
    onFailed: () => {
      setGenerating(false);
      setPollingJobId(null);
    },
  });

  const fetchRunsheet = useCallback(async () => {
    if (!currentEpisode) return;
    const res = await fetch(`/api/runsheet?episode_id=${currentEpisode.id}`);
    const json = await res.json();
    if (json.runsheet) setRunsheet(json.runsheet);
  }, [currentEpisode]);

  useEffect(() => {
    fetchRunsheet();
  }, [fetchRunsheet]);

  async function generateRunsheet() {
    if (!currentShow || !currentEpisode) return;
    setGenerating(true);
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        skillName: "runsheet",
        showId: currentShow.id,
        episodeId: currentEpisode.id,
        payload: {},
      }),
    });
    const json = await res.json();
    if (json.job) {
      setPollingJobId(json.job.id);
    } else {
      setGenerating(false);
    }
  }

  function copyAll() {
    if (!segments.length) return;
    const text = segments
      .map(
        (s) =>
          `## ${s.name} [${s.time_label}]\n\n### Rik Intro\n${s.rik_intro}\n\n### Seed Points\n${s.seed_points.map((sp) => `**${sp.host}:**\n${sp.points.map((p) => `- ${p}`).join("\n")}`).join("\n\n")}\n\n### Tight Questions\n${s.tight_questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\n### Debate Positions\n${s.debate_positions.map((d) => `- ${d.host}: ${d.position}`).join("\n")}`
      )
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(text);
  }

  if (!currentEpisode) {
    return (
      <div className="text-center py-16 text-text-muted">
        <p className="text-sm">Select an episode from the top bar.</p>
      </div>
    );
  }

  const segments: RunsheetSegment[] =
    (runsheet?.content as { segments?: RunsheetSegment[] })?.segments || [];

  if (printView) {
    return (
      <div className="bg-white text-black min-h-screen p-12 max-w-4xl mx-auto font-sans">
        <div className="flex items-center justify-between mb-8 border-b-2 border-black pb-4">
          <div>
            <h1 className="text-3xl font-bold">
              EP {String(currentEpisode.episode_number).padStart(2, "0")} — {currentEpisode.title}
            </h1>
            {currentEpisode.recording_date && (
              <p className="text-gray-600">
                {new Date(currentEpisode.recording_date).toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
          <button
            onClick={() => setPrintView(false)}
            className="text-sm text-gray-500 hover:text-black print:hidden"
          >
            Exit Print View
          </button>
        </div>
        {segments.map((seg, i) => (
          <div key={i} className="mb-8 break-inside-avoid">
            <h2 className="text-xl font-bold mb-1">
              {seg.name} <span className="text-gray-500 font-normal">[{seg.time_label}]</span>
            </h2>
            {seg.rik_intro && (
              <div className="bg-gray-100 border-l-4 border-black p-3 mb-3 italic">
                {seg.rik_intro}
              </div>
            )}
            {seg.seed_points.map((sp, j) => (
              <div key={j} className="mb-2">
                <strong>{sp.host}:</strong>
                <ul className="ml-4 list-disc">
                  {sp.points.map((p, k) => (
                    <li key={k}>{p}</li>
                  ))}
                </ul>
              </div>
            ))}
            {seg.tight_questions.length > 0 && (
              <div className="bg-gray-50 border border-gray-300 rounded p-3 mt-2">
                <strong className="text-sm uppercase">Tight Questions</strong>
                <ol className="ml-4 list-decimal mt-1">
                  {seg.tight_questions.map((q, j) => (
                    <li key={j}>{q}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-5xl text-accent mb-1">RUNSHEET</h1>
        <p className="text-text-secondary text-sm">
          Production document for EP {String(currentEpisode.episode_number).padStart(2, "0")}.
        </p>
      </div>

      {segments.length === 0 && !generating ? (
        <div className="bg-bg-surface border border-border rounded-lg p-12 text-center">
          <p className="text-text-muted text-sm mb-4">
            No runsheet generated yet. Generate one from the research brief.
          </p>
          <button
            onClick={generateRunsheet}
            className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg text-sm transition-colors"
          >
            Generate Runsheet
          </button>
        </div>
      ) : generating ? (
        <div className="bg-bg-surface border border-border rounded-lg p-12 text-center">
          <Loader2 size={24} className="animate-spin text-accent mx-auto mb-3" />
          <p className="text-sm text-text-secondary">
            {jobStatus === "pending" && "Queued — waiting for worker..."}
            {jobStatus === "running" && "Generating runsheet..."}
            {!jobStatus && "Submitting job..."}
          </p>
        </div>
      ) : (
        <div className="flex gap-4 h-[calc(100vh-220px)]">
          {/* Left: Structure Rail (30%) */}
          <div className="w-[30%] bg-bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
            <div className="p-3 border-b border-border">
              <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
                Structure
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {(segments.length > 0 ? segments : DEFAULT_SEGMENTS).map((seg, i) => {
                const isActive = activeSegment === i;
                const s = segments[i];
                const overUnder = s
                  ? s.duration_minutes / DEFAULT_SEGMENTS[i].duration_minutes
                  : 1;
                const timeWarning = overUnder > 1.2 || overUnder < 0.8;

                return (
                  <button
                    key={i}
                    onClick={() => setActiveSegment(i)}
                    className={`w-full flex items-center gap-3 px-4 py-3 border-b border-border text-left transition-colors ${
                      isActive
                        ? "bg-accent/10 border-l-2 border-l-accent"
                        : "hover:bg-bg-elevated"
                    }`}
                  >
                    <GripVertical size={14} className="text-text-muted cursor-grab shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text-primary">{seg.name}</div>
                      <div
                        className={`text-[11px] font-mono ${
                          timeWarning ? "text-warning" : "text-text-muted"
                        }`}
                      >
                        {"time_label" in seg ? seg.time_label : (seg as typeof DEFAULT_SEGMENTS[number]).time_label}
                      </div>
                    </div>
                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Content (70%) */}
          <div className="w-[70%] bg-bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
            {/* Toolbar */}
            <div className="p-3 border-b border-border flex items-center gap-2">
              <button
                onClick={copyAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-elevated border border-border text-text-secondary text-sm hover:text-text-primary transition-colors"
              >
                <Copy size={14} /> Copy All
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-elevated border border-border text-text-secondary text-sm hover:text-text-primary transition-colors">
                <Download size={14} /> Export PDF
              </button>
              <button
                onClick={() => setPrintView(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-elevated border border-border text-text-secondary text-sm hover:text-text-primary transition-colors"
              >
                <Printer size={14} /> Print View
              </button>
              <div className="flex-1" />
              <button
                onClick={generateRunsheet}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-elevated border border-border text-text-secondary text-sm hover:text-text-primary transition-colors"
              >
                <RefreshCw size={14} /> Regenerate
              </button>
            </div>

            {/* Runsheet Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {segments[activeSegment] ? (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-display text-3xl text-accent mb-1">
                      {segments[activeSegment].name}
                    </h2>
                    <span className="text-sm font-mono text-text-muted">
                      {segments[activeSegment].time_label}
                    </span>
                  </div>

                  {/* Rik Intro */}
                  {segments[activeSegment].rik_intro && (
                    <div className="bg-bg-elevated border-l-2 border-accent rounded-r-lg p-4">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Mic size={14} className="text-accent" />
                        <span className="text-[11px] font-medium uppercase tracking-wider text-accent">
                          Rik Intro
                        </span>
                      </div>
                      <p className="text-base text-text-secondary italic leading-relaxed">
                        {segments[activeSegment].rik_intro}
                      </p>
                    </div>
                  )}

                  {/* Seed Points */}
                  {segments[activeSegment].seed_points.map((sp, i) => (
                    <div key={i}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <MessageSquare size={14} className="text-text-secondary" />
                        <span className="text-sm font-semibold text-text-primary">
                          {sp.host}
                        </span>
                      </div>
                      <ul className="space-y-1.5 ml-5">
                        {sp.points.map((p, j) => (
                          <li key={j} className="text-sm text-text-secondary list-disc">
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}

                  {/* Tight Questions */}
                  {segments[activeSegment].tight_questions.length > 0 && (
                    <div className="bg-bg-elevated rounded-lg p-4 border border-border">
                      <div className="flex items-center gap-1.5 mb-3">
                        <HelpCircle size={14} className="text-warning" />
                        <span className="text-[11px] font-medium uppercase tracking-wider text-warning">
                          Tight Questions
                        </span>
                      </div>
                      <ol className="space-y-2">
                        {segments[activeSegment].tight_questions.map((q, i) => (
                          <li key={i} className="flex gap-2 text-sm text-text-secondary">
                            <span className="text-accent font-mono font-bold shrink-0">{i + 1}.</span>
                            {q}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Debate Positions */}
                  {segments[activeSegment].debate_positions.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Swords size={14} className="text-text-muted" />
                        <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                          Expected Positions
                        </span>
                      </div>
                      <div className="space-y-1">
                        {segments[activeSegment].debate_positions.map((d, i) => (
                          <div key={i} className="text-sm text-text-secondary">
                            <span className="font-medium text-text-primary">{d.host}:</span>{" "}
                            {d.position}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16 text-text-muted text-sm">
                  Select a segment from the structure rail.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
