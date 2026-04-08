"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Presentation,
  FileText,
  Megaphone,
  Loader2,
  Copy,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Mic,
  MessageSquare,
  HelpCircle,
  Swords,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import { useJobPoll } from "@/lib/hooks/use-job-poll";
import type { EpisodeSlides, Slide, SlideStyle, Hooks, Runsheet } from "@godmodeprod/shared";

type PrepTab = "slides" | "notes" | "hooks";

interface RunsheetSegment {
  name: string;
  time_label: string;
  duration_minutes: number;
  rik_intro: string;
  seed_points: Array<{ host: string; points: string[] }>;
  tight_questions: string[];
  debate_positions: Array<{ host: string; position: string }>;
}

function normalizeSegment(raw: Record<string, unknown>): RunsheetSegment {
  let seedPoints: RunsheetSegment["seed_points"] = [];
  if (Array.isArray(raw.seed_points)) {
    seedPoints = raw.seed_points;
  } else if (raw.seed_points && typeof raw.seed_points === "object") {
    seedPoints = Object.entries(raw.seed_points as Record<string, string[]>).map(
      ([host, points]) => ({ host: host.charAt(0).toUpperCase() + host.slice(1), points })
    );
  }

  let debatePositions: RunsheetSegment["debate_positions"] = [];
  if (Array.isArray(raw.debate_positions)) {
    debatePositions = raw.debate_positions;
  } else if (raw.debate_positions && typeof raw.debate_positions === "object") {
    debatePositions = Object.entries(raw.debate_positions as Record<string, string>).map(
      ([host, position]) => ({ host: host.charAt(0).toUpperCase() + host.slice(1), position })
    );
  }

  return {
    name: (raw.name as string) || "",
    time_label: (raw.time_label as string) || "",
    duration_minutes: (raw.duration_minutes as number) || 0,
    rik_intro: (raw.rik_intro as string) || "",
    seed_points: seedPoints,
    tight_questions: Array.isArray(raw.tight_questions) ? raw.tight_questions : [],
    debate_positions: debatePositions,
  };
}

const SLIDE_TYPE_LABELS: Record<string, string> = {
  title_card: "Title",
  topic_intro: "Topic",
  data_point: "Data",
  talking_point: "Point",
  quote: "Quote",
  closer: "Close",
};

const SLIDE_TYPE_COLORS: Record<string, string> = {
  title_card: "bg-accent/20 text-accent",
  topic_intro: "bg-blue-500/20 text-blue-400",
  data_point: "bg-green-500/20 text-green-400",
  talking_point: "bg-purple-500/20 text-purple-400",
  quote: "bg-yellow-500/20 text-yellow-400",
  closer: "bg-orange-500/20 text-orange-400",
};

export default function PrepPage() {
  const router = useRouter();
  const { currentShow, currentEpisode } = useEpisodeStore();
  const [activeTab, setActiveTab] = useState<PrepTab>("slides");

  // Slides state
  const [slidesData, setSlidesData] = useState<EpisodeSlides | null>(null);
  const [generatingSlides, setGeneratingSlides] = useState(false);
  const [slidesJobId, setSlidesJobId] = useState<string | null>(null);
  const [slidesError, setSlidesError] = useState<string | null>(null);

  // Notes state (from runsheet)
  const [runsheet, setRunsheet] = useState<Runsheet | null>(null);
  const [expandedSegments, setExpandedSegments] = useState<Set<number>>(new Set([0]));

  // Hooks state
  const [hooksData, setHooksData] = useState<Hooks | null>(null);
  const [generatingHooks, setGeneratingHooks] = useState(false);
  const [hooksJobId, setHooksJobId] = useState<string | null>(null);
  const [hooksError, setHooksError] = useState<string | null>(null);

  // Slides job polling
  useJobPoll({
    jobId: slidesJobId,
    enabled: generatingSlides,
    onComplete: async () => {
      await fetchSlides();
      setGeneratingSlides(false);
      setSlidesJobId(null);
    },
    onFailed: (err) => {
      setSlidesError(`Slide generation failed: ${err || "Unknown error"}`);
      setGeneratingSlides(false);
      setSlidesJobId(null);
    },
  });

  // Hooks job polling
  useJobPoll({
    jobId: hooksJobId,
    enabled: generatingHooks,
    onComplete: async () => {
      await fetchHooks();
      setGeneratingHooks(false);
      setHooksJobId(null);
    },
    onFailed: (err) => {
      setHooksError(`Hook generation failed: ${err || "Unknown error"}`);
      setGeneratingHooks(false);
      setHooksJobId(null);
    },
  });

  const fetchSlides = useCallback(async () => {
    if (!currentEpisode) return;
    const res = await fetch(`/api/slides?episode_id=${currentEpisode.id}`);
    const json = await res.json();
    if (json.slides) setSlidesData(json.slides);
  }, [currentEpisode]);

  const fetchHooks = useCallback(async () => {
    if (!currentEpisode) return;
    const res = await fetch(`/api/hooks?episode_id=${currentEpisode.id}`);
    const json = await res.json();
    if (json.hooks) setHooksData(json.hooks);
  }, [currentEpisode]);

  const fetchRunsheet = useCallback(async () => {
    if (!currentEpisode) return;
    const res = await fetch(`/api/runsheet?episode_id=${currentEpisode.id}`);
    const json = await res.json();
    if (json.runsheet) setRunsheet(json.runsheet);
  }, [currentEpisode]);

  useEffect(() => {
    fetchSlides();
    fetchHooks();
    fetchRunsheet();
  }, [fetchSlides, fetchHooks, fetchRunsheet]);

  async function generateSlides() {
    if (!currentShow || !currentEpisode) return;
    setSlidesError(null);
    setGeneratingSlides(true);
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        skillName: "slide-generation",
        showId: currentShow.id,
        episodeId: currentEpisode.id,
        payload: {},
      }),
    });
    const json = await res.json();
    if (json.job) {
      setSlidesJobId(json.job.id);
    } else {
      setGeneratingSlides(false);
    }
  }

  async function generateHooks() {
    if (!currentShow || !currentEpisode) return;
    setHooksError(null);
    setGeneratingHooks(true);

    const topicsRes = await fetch(
      `/api/docket/topics?episode_id=${currentEpisode.id}&status=in`
    );
    const topicsJson = await topicsRes.json();
    const topics = (topicsJson.topics || []).map((t: { title: string; angle: string }) => ({
      title: t.title,
      angle: t.angle,
    }));

    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        skillName: "hook-writing",
        showId: currentShow.id,
        episodeId: currentEpisode.id,
        payload: {
          episodeTitle: currentEpisode.title,
          episodeNumber: currentEpisode.episode_number,
          topics,
        },
      }),
    });
    const json = await res.json();
    if (json.job) {
      setHooksJobId(json.job.id);
    } else {
      setGeneratingHooks(false);
    }
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
  }

  if (!currentEpisode) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Presentation size={40} strokeWidth={1} className="text-text-muted mb-3" />
        <h2 className="font-display text-2xl text-text-secondary mb-1">No Episode Selected</h2>
        <p className="text-sm text-text-muted">Select an episode from the top bar to access prep materials.</p>
      </div>
    );
  }

  const slides: Slide[] = (slidesData?.content as { slides?: Slide[] })?.slides || [];
  const style: SlideStyle = (slidesData?.style as SlideStyle) || { brandColor: "#E8001D", font: "Inter", layout: "minimal" };
  const rawSegments = (runsheet?.content as { segments?: Record<string, unknown>[] })?.segments || [];
  const segments: RunsheetSegment[] = rawSegments.map(normalizeSegment);

  const TABS: { key: PrepTab; label: string; icon: typeof Presentation; hasData: boolean }[] = [
    { key: "slides", label: "Slides", icon: Presentation, hasData: slides.length > 0 },
    { key: "notes", label: "Notes", icon: FileText, hasData: segments.length > 0 },
    { key: "hooks", label: "Hooks", icon: Megaphone, hasData: !!hooksData },
  ];

  function downloadSlidesMarkdown() {
    if (!currentEpisode) return;
    const text = slides
      .map((s, i) => {
        let md = `### Slide ${i + 1}: ${SLIDE_TYPE_LABELS[s.type] || s.type} — ${s.heading}`;
        if (s.bullets?.length) md += "\n" + s.bullets.map((b) => `- ${b}`).join("\n");
        if (s.data_value) md += `\n**${s.data_label || "Data"}:** ${s.data_value}`;
        if (s.speaker_notes) md += `\n> _${s.speaker_notes}_`;
        if (s.source) md += `\n_Source: ${s.source}_`;
        return md;
      })
      .join("\n\n---\n\n");
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `slides-ep${String(currentEpisode.episode_number).padStart(2, "0")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-5xl text-accent mb-1">PREP</h1>
        <p className="text-text-secondary text-sm">
          Slides, notes & hooks for EP {String(currentEpisode.episode_number).padStart(2, "0")}.
        </p>
      </div>

      <div className="flex gap-4 h-[calc(100vh-220px)]">
        {/* Left: Tab Rail (25%) */}
        <div className="w-[25%] bg-bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
          <div className="p-3 border-b border-border">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
              Sections
            </h3>
          </div>

          <div className="flex-1">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 border-b border-border text-left transition-colors ${
                    isActive
                      ? "bg-accent/10 border-l-2 border-l-accent"
                      : "hover:bg-bg-elevated"
                  }`}
                >
                  <Icon size={18} strokeWidth={1.5} className={isActive ? "text-accent" : "text-text-muted"} />
                  <span className={`text-sm font-medium ${isActive ? "text-accent" : "text-text-primary"}`}>
                    {tab.label}
                  </span>
                  <div className="flex-1" />
                  {tab.hasData ? (
                    <CheckCircle2 size={14} className="text-green-500" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-border" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Context links */}
          <div className="p-3 border-t border-border space-y-2">
            <button
              onClick={() => router.push("/research")}
              className="flex items-center gap-2 text-xs text-text-muted hover:text-text-secondary transition-colors w-full"
            >
              <ArrowLeft size={12} /> Back to Research
            </button>
            <button
              onClick={() => router.push("/runsheet")}
              className="flex items-center gap-2 text-xs text-text-muted hover:text-text-secondary transition-colors w-full"
            >
              <ArrowLeft size={12} /> Back to Runsheet
            </button>
          </div>
        </div>

        {/* Right: Content (75%) */}
        <div className="w-[75%] bg-bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
          {/* === SLIDES TAB === */}
          {activeTab === "slides" && (
            <>
              <div className="p-3 border-b border-border flex items-center gap-2">
                {slides.length > 0 && (
                  <>
                    <a
                      href={`/slides/${currentEpisode.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
                    >
                      <ExternalLink size={14} /> Open Deck
                    </a>
                    <button
                      onClick={() =>
                        copyText(
                          slides
                            .map((s) => `[${SLIDE_TYPE_LABELS[s.type]}] ${s.heading}${s.bullets?.length ? "\n" + s.bullets.map((b) => `  - ${b}`).join("\n") : ""}`)
                            .join("\n\n")
                        )
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-elevated border border-border text-text-secondary text-sm hover:text-text-primary transition-colors"
                    >
                      <Copy size={14} /> Copy All
                    </button>
                    <button
                      onClick={downloadSlidesMarkdown}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-elevated border border-border text-text-secondary text-sm hover:text-text-primary transition-colors"
                    >
                      <Download size={14} /> Download .md
                    </button>
                  </>
                )}
                <div className="flex-1" />
                <button
                  onClick={generateSlides}
                  disabled={generatingSlides}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent/10 border border-accent/20 text-accent text-sm hover:bg-accent/20 transition-colors disabled:opacity-50"
                >
                  {generatingSlides ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  {slides.length > 0 ? "Regenerate" : "Generate Slides"}
                </button>
              </div>

              {slidesError && (
                <div className="mx-4 mt-3 p-3 bg-error/10 border border-error/20 rounded-lg text-sm text-error flex items-center gap-2">
                  <AlertCircle size={14} /> {slidesError}
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4">
                {generatingSlides ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 size={24} className="animate-spin text-accent mb-3" />
                    <p className="text-sm text-text-secondary">Generating slides from research...</p>
                  </div>
                ) : slides.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Presentation size={32} strokeWidth={1} className="text-text-muted mb-3" />
                    <p className="text-sm text-text-muted mb-4">
                      No slides yet. Generate presentation cards from your research brief.
                    </p>
                    <button
                      onClick={generateSlides}
                      className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg text-sm transition-colors"
                    >
                      Generate Slides
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {slides.map((slide, i) => (
                      <div
                        key={i}
                        className="bg-bg-elevated border border-border rounded-lg p-4 hover:border-border/80 transition-colors"
                        style={{ borderLeftColor: style.brandColor, borderLeftWidth: 3 }}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-xs font-mono text-text-muted mt-0.5">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className={`text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded ${SLIDE_TYPE_COLORS[slide.type] || "bg-bg-surface text-text-muted"}`}>
                                {SLIDE_TYPE_LABELS[slide.type] || slide.type}
                              </span>
                            </div>
                            <h3 className="text-base font-semibold text-text-primary mb-1">
                              {slide.heading}
                            </h3>
                            {slide.data_value && (
                              <div className="mb-2">
                                <span className="text-2xl font-bold" style={{ color: style.brandColor }}>
                                  {slide.data_value}
                                </span>
                                {slide.data_label && (
                                  <span className="text-sm text-text-muted ml-2">{slide.data_label}</span>
                                )}
                              </div>
                            )}
                            {slide.bullets && slide.bullets.length > 0 && (
                              <ul className="space-y-1 mt-2">
                                {slide.bullets.map((b, j) => (
                                  <li key={j} className="text-sm text-text-secondary flex gap-2">
                                    <span className="text-text-muted shrink-0">&bull;</span>
                                    {b}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {slide.speaker_notes && (
                              <div className="mt-2 pt-2 border-t border-border">
                                <p className="text-xs text-text-muted italic">{slide.speaker_notes}</p>
                              </div>
                            )}
                            {slide.source && (
                              <p className="text-[11px] text-text-muted mt-1">Source: {slide.source}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* === NOTES TAB === */}
          {activeTab === "notes" && (
            <>
              <div className="p-3 border-b border-border flex items-center gap-2">
                {segments.length > 0 && (
                  <button
                    onClick={() => {
                      const text = segments
                        .map(
                          (s) =>
                            `## ${s.name} [${s.time_label}]\n\n### Rik Intro\n${s.rik_intro}\n\n### Seed Points\n${s.seed_points.map((sp) => `**${sp.host}:**\n${sp.points.map((p) => `- ${p}`).join("\n")}`).join("\n\n")}\n\n### Tight Questions\n${s.tight_questions.map((q, qi) => `${qi + 1}. ${q}`).join("\n")}\n\n### Debate Positions\n${s.debate_positions.map((d) => `- ${d.host}: ${d.position}`).join("\n")}`
                        )
                        .join("\n\n---\n\n");
                      copyText(text);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-elevated border border-border text-text-secondary text-sm hover:text-text-primary transition-colors"
                  >
                    <Copy size={14} /> Copy All Notes
                  </button>
                )}
                <div className="flex-1" />
                <span className="text-[11px] text-text-muted">From Runsheet</span>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {segments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <FileText size={32} strokeWidth={1} className="text-text-muted mb-3" />
                    <p className="text-sm text-text-muted mb-4">
                      No runsheet generated yet. Generate one first to see presenter notes.
                    </p>
                    <button
                      onClick={() => router.push("/runsheet")}
                      className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg text-sm transition-colors"
                    >
                      Go to Runsheet
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {segments.map((seg, i) => {
                      const isExpanded = expandedSegments.has(i);
                      return (
                        <div key={i} className="bg-bg-elevated border border-border rounded-lg overflow-hidden">
                          <button
                            onClick={() => {
                              const next = new Set(expandedSegments);
                              if (isExpanded) next.delete(i);
                              else next.add(i);
                              setExpandedSegments(next);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg-surface transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDown size={14} className="text-text-muted" />
                            ) : (
                              <ChevronRight size={14} className="text-text-muted" />
                            )}
                            <span className="text-sm font-semibold text-text-primary flex-1">
                              {seg.name}
                            </span>
                            <span className="text-xs font-mono text-text-muted">{seg.time_label}</span>
                          </button>

                          {isExpanded && (
                            <div className="px-4 pb-4 space-y-4">
                              {seg.rik_intro && (
                                <div className="bg-bg-surface border-l-2 border-accent rounded-r-lg p-3">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Mic size={12} className="text-accent" />
                                    <span className="text-[10px] font-medium uppercase tracking-wider text-accent">Rik Intro</span>
                                  </div>
                                  <p className="text-sm text-text-secondary italic">{seg.rik_intro}</p>
                                </div>
                              )}

                              {seg.seed_points.map((sp, j) => (
                                <div key={j}>
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <MessageSquare size={12} className="text-text-secondary" />
                                    <span className="text-xs font-semibold text-text-primary">{sp.host}</span>
                                  </div>
                                  <ul className="space-y-1 ml-4">
                                    {sp.points.map((p, k) => (
                                      <li key={k} className="text-sm text-text-secondary list-disc">{p}</li>
                                    ))}
                                  </ul>
                                </div>
                              ))}

                              {seg.tight_questions.length > 0 && (
                                <div className="bg-bg-surface rounded-lg p-3 border border-border">
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <HelpCircle size={12} className="text-warning" />
                                    <span className="text-[10px] font-medium uppercase tracking-wider text-warning">Tight Questions</span>
                                  </div>
                                  <ol className="space-y-1">
                                    {seg.tight_questions.map((q, j) => (
                                      <li key={j} className="flex gap-2 text-sm text-text-secondary">
                                        <span className="text-accent font-mono font-bold shrink-0">{j + 1}.</span>
                                        {q}
                                      </li>
                                    ))}
                                  </ol>
                                </div>
                              )}

                              {seg.debate_positions.length > 0 && (
                                <div>
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Swords size={12} className="text-text-muted" />
                                    <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">Debate Positions</span>
                                  </div>
                                  <div className="space-y-1">
                                    {seg.debate_positions.map((d, j) => (
                                      <div key={j} className="text-sm text-text-secondary">
                                        <span className="font-medium text-text-primary">{d.host}:</span> {d.position}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* === HOOKS TAB === */}
          {activeTab === "hooks" && (
            <>
              <div className="p-3 border-b border-border flex items-center gap-2">
                <div className="flex-1" />
                <button
                  onClick={generateHooks}
                  disabled={generatingHooks}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent/10 border border-accent/20 text-accent text-sm hover:bg-accent/20 transition-colors disabled:opacity-50"
                >
                  {generatingHooks ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  {hooksData ? "Regenerate" : "Generate Hooks"}
                </button>
              </div>

              {hooksError && (
                <div className="mx-4 mt-3 p-3 bg-error/10 border border-error/20 rounded-lg text-sm text-error flex items-center gap-2">
                  <AlertCircle size={14} /> {hooksError}
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4">
                {generatingHooks ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 size={24} className="animate-spin text-accent mb-3" />
                    <p className="text-sm text-text-secondary">Generating hooks...</p>
                  </div>
                ) : !hooksData ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Megaphone size={32} strokeWidth={1} className="text-text-muted mb-3" />
                    <p className="text-sm text-text-muted mb-4">
                      No hooks yet. Generate YouTube titles, descriptions, and promotional copy.
                    </p>
                    <button
                      onClick={generateHooks}
                      className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg text-sm transition-colors"
                    >
                      Generate Hooks
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <HookSection
                      label="YouTube Titles"
                      onCopy={() => copyText((hooksData.youtube_titles as string[]).join("\n"))}
                    >
                      <div className="space-y-2">
                        {(hooksData.youtube_titles as string[])?.map((title, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-xs font-mono text-text-muted">{i + 1}.</span>
                            <span className="text-sm text-text-primary">{title}</span>
                          </div>
                        ))}
                      </div>
                    </HookSection>

                    <HookSection
                      label="YouTube Description"
                      onCopy={() => copyText(hooksData.youtube_desc)}
                    >
                      <p className="text-sm text-text-secondary whitespace-pre-wrap">{hooksData.youtube_desc}</p>
                    </HookSection>

                    <HookSection
                      label="Podcast Description"
                      onCopy={() => copyText(hooksData.podcast_desc)}
                    >
                      <p className="text-sm text-text-secondary whitespace-pre-wrap">{hooksData.podcast_desc}</p>
                    </HookSection>

                    <HookSection
                      label="Email Subject"
                      onCopy={() => copyText(hooksData.email_subject)}
                    >
                      <p className="text-sm text-text-primary font-medium">{hooksData.email_subject}</p>
                    </HookSection>

                    <HookSection
                      label="Opening Tweet"
                      onCopy={() => copyText(hooksData.opening_tweet)}
                    >
                      <p className="text-sm text-text-secondary">{hooksData.opening_tweet}</p>
                    </HookSection>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function HookSection({
  label,
  onCopy,
  children,
}: {
  label: string;
  onCopy: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-bg-elevated border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
          {label}
        </span>
        <button
          onClick={onCopy}
          className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          <Copy size={12} /> Copy
        </button>
      </div>
      {children}
    </div>
  );
}
