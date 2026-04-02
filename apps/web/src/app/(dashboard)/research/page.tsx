"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Copy,
  Download,
  RefreshCw,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Loader2,
  User,
} from "lucide-react";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import type { DocketTopic, ResearchBrief } from "@godmodeprod/shared";

interface BriefSection {
  topic_title: string;
  what_happened: string;
  core_thesis: string;
  steel_man: string;
  straw_man: string;
  analogy: string;
  data_points: string[];
  sample_dialogue: string;
  connecting_threads: string[];
}

export default function ResearchPage() {
  const { currentShow, currentEpisode } = useEpisodeStore();
  const [topics, setTopics] = useState<DocketTopic[]>([]);
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string>>(new Set());
  const [brief, setBrief] = useState<ResearchBrief | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [guestMode, setGuestMode] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestBio, setGuestBio] = useState("");
  const [episodeContext, setEpisodeContext] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState("");

  const fetchData = useCallback(async () => {
    if (!currentEpisode || !currentShow) return;
    // Fetch confirmed docket topics
    const topicsRes = await fetch(
      `/api/docket/topics?episode_id=${currentEpisode.id}&status=in`
    );
    const topicsJson = await topicsRes.json();
    const confirmedTopics = topicsJson.topics || [];
    setTopics(confirmedTopics);
    setSelectedTopicIds(new Set(confirmedTopics.map((t: DocketTopic) => t.id)));

    // Fetch existing brief
    const briefRes = await fetch(`/api/research?episode_id=${currentEpisode.id}`);
    const briefJson = await briefRes.json();
    if (briefJson.brief) setBrief(briefJson.brief);
  }, [currentEpisode, currentShow]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function toggleTopic(id: string) {
    setSelectedTopicIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSection(index: number) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function generateBrief() {
    if (!currentShow || !currentEpisode || selectedTopicIds.size === 0) return;
    setGenerating(true);
    setGeneratingStep("Preparing topics...");

    // Dispatch job to worker
    const selectedTopics = topics.filter((t) => selectedTopicIds.has(t.id));

    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        skillName: "research-brief",
        showId: currentShow.id,
        episodeId: currentEpisode.id,
        payload: {
          topics: selectedTopics.map((t) => ({
            id: t.id,
            title: t.title,
            context: t.context,
            angle: t.angle,
            sources: t.sources,
          })),
          episodeContext,
          guestMode,
          guestName: guestMode ? guestName : undefined,
          guestBio: guestMode ? guestBio : undefined,
        },
      }),
    });

    const json = await res.json();
    if (json.job) {
      // Simulate progress steps while waiting
      const steps = selectedTopics.map((t) => `Researching: ${t.title}...`);
      for (const step of steps) {
        setGeneratingStep(step);
        await new Promise((r) => setTimeout(r, 1500));
      }
      setGeneratingStep("Compiling brief...");
      await new Promise((r) => setTimeout(r, 1000));

      // Refresh brief
      const briefRes = await fetch(`/api/research?episode_id=${currentEpisode.id}`);
      const briefJson = await briefRes.json();
      if (briefJson.brief) setBrief(briefJson.brief);
    }

    setGenerating(false);
    setGeneratingStep("");
  }

  function copyAll() {
    const sections = (brief?.content as { sections?: BriefSection[] })?.sections;
    if (!sections) return;
    const text = sections
      .map(
        (s) =>
          `# ${s.topic_title}\n\n## What Happened\n${s.what_happened}\n\n## Core Thesis\n${s.core_thesis}\n\n## Steel Man\n${s.steel_man}\n\n## Straw Man\n${s.straw_man}\n\n## Analogy\n${s.analogy}\n\n## Data Points\n${s.data_points.map((d) => `- ${d}`).join("\n")}\n\n## Sample Dialogue\n${s.sample_dialogue}\n\n## Connecting Threads\n${s.connecting_threads.map((t) => `- ${t}`).join("\n")}`
      )
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(text);
  }

  if (!currentEpisode) {
    return (
      <div className="text-center py-16 text-text-muted">
        <p className="text-sm">Select an episode from the top bar to generate research.</p>
      </div>
    );
  }

  const sections = (brief?.content as { sections?: BriefSection[] })?.sections || [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-5xl text-accent mb-1">RESEARCH BRIEF</h1>
        <p className="text-text-secondary text-sm">
          Generate pre-show research for EP {String(currentEpisode.episode_number).padStart(2, "0")}.
        </p>
      </div>

      <div className="flex gap-4 h-[calc(100vh-220px)]">
        {/* Left: Brief Builder (35%) */}
        <div className="w-[35%] bg-bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted mb-3">
              Confirmed Topics
            </h3>
            {topics.length === 0 ? (
              <p className="text-sm text-text-muted">
                No confirmed topics. Mark topics as &quot;In&quot; on the Docket page first.
              </p>
            ) : (
              <div className="space-y-1.5">
                {topics.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-bg-elevated transition-colors cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTopicIds.has(t.id)}
                      onChange={() => toggleTopic(t.id)}
                      className="accent-accent"
                    />
                    <span className="text-sm text-text-primary">{t.title}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-b border-border space-y-3">
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
                Episode Context (optional)
              </label>
              <textarea
                value={episodeContext}
                onChange={(e) => setEpisodeContext(e.target.value)}
                placeholder="Any specific framing or focus for this episode..."
                rows={3}
                className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setGuestMode(!guestMode)}
                className={`relative w-9 h-5 rounded-full transition-colors ${
                  guestMode ? "bg-accent" : "bg-bg-elevated border border-border"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                    guestMode ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
              <span className="text-sm text-text-secondary flex items-center gap-1.5">
                <User size={14} /> Guest Episode
              </span>
            </div>

            {guestMode && (
              <div className="space-y-2 pl-2 border-l-2 border-accent/30">
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Guest name..."
                  className="w-full bg-bg-elevated border border-border rounded-md px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                />
                <textarea
                  value={guestBio}
                  onChange={(e) => setGuestBio(e.target.value)}
                  placeholder="Guest bio / relevant background..."
                  rows={2}
                  className="w-full bg-bg-elevated border border-border rounded-md px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-none"
                />
              </div>
            )}
          </div>

          <div className="p-4 mt-auto">
            {generating ? (
              <div className="text-center py-3">
                <Loader2 size={20} className="animate-spin text-accent mx-auto mb-2" />
                <p className="text-sm text-text-secondary">{generatingStep}</p>
              </div>
            ) : (
              <button
                onClick={generateBrief}
                disabled={selectedTopicIds.size === 0}
                className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
              >
                Generate Research Brief
              </button>
            )}
          </div>
        </div>

        {/* Right: Brief Output (65%) */}
        <div className="w-[65%] bg-bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
          {/* Toolbar */}
          <div className="p-3 border-b border-border flex items-center gap-2">
            <button
              onClick={copyAll}
              disabled={sections.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-elevated border border-border text-text-secondary text-sm hover:text-text-primary hover:border-text-muted transition-colors disabled:opacity-50"
            >
              <Copy size={14} /> Copy All
            </button>
            <button
              disabled={sections.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-elevated border border-border text-text-secondary text-sm hover:text-text-primary hover:border-text-muted transition-colors disabled:opacity-50"
            >
              <Download size={14} /> Download .md
            </button>
            <div className="flex-1" />
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent/15 text-accent text-sm hover:bg-accent/25 transition-colors">
              <ArrowRight size={14} /> Send to Runsheet
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {sections.length === 0 ? (
              <div className="text-center py-16 text-text-muted">
                <p className="text-sm mb-1">No research brief generated yet.</p>
                <p className="text-[11px]">Select topics and click Generate to start.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sections.map((section, i) => (
                  <div key={i} className="border border-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleSection(i)}
                      className="w-full flex items-center justify-between p-4 hover:bg-bg-elevated transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-success" />
                        <span className="text-base font-semibold text-text-primary">
                          {section.topic_title}
                        </span>
                      </div>
                      {expandedSections.has(i) ? (
                        <ChevronDown size={16} className="text-text-muted" />
                      ) : (
                        <ChevronRight size={16} className="text-text-muted" />
                      )}
                    </button>

                    {expandedSections.has(i) && (
                      <div className="px-4 pb-4 space-y-4">
                        <div>
                          <h4 className="text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1">What Happened</h4>
                          <p className="text-sm text-text-secondary">{section.what_happened}</p>
                        </div>
                        <div>
                          <h4 className="text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1">Core Thesis</h4>
                          <p className="text-sm text-text-secondary">{section.core_thesis}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-[11px] font-medium uppercase tracking-wider text-success mb-1">Steel Man</h4>
                            <p className="text-sm text-text-secondary">{section.steel_man}</p>
                          </div>
                          <div>
                            <h4 className="text-[11px] font-medium uppercase tracking-wider text-error mb-1">Straw Man</h4>
                            <p className="text-sm text-text-secondary">{section.straw_man}</p>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1">Best Analogy</h4>
                          <p className="text-sm text-text-secondary">{section.analogy}</p>
                        </div>
                        <div>
                          <h4 className="text-[11px] font-medium uppercase tracking-wider text-warning mb-1">Data Points</h4>
                          <div className="space-y-1">
                            {section.data_points.map((d, j) => (
                              <div key={j} className="bg-warning/5 border border-warning/20 rounded px-3 py-1.5 text-sm text-text-secondary">
                                {d}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1">Sample Dialogue</h4>
                          <div className="bg-bg-elevated rounded-lg p-3 italic text-sm text-text-secondary border-l-2 border-accent/30">
                            {section.sample_dialogue}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1">Connecting Threads</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {section.connecting_threads.map((t, j) => (
                              <span key={j} className="px-2 py-0.5 bg-bg-elevated rounded text-[11px] text-text-secondary border border-border">
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button className="flex items-center gap-1.5 text-sm text-accent hover:underline">
                          <RefreshCw size={12} /> Regenerate this section
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
