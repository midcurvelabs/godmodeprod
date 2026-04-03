"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Clock, Film, Quote } from "lucide-react";
import { CopyButton } from "./copy-button";

const SPEAKER_COLORS = ["text-accent", "text-emerald-400", "text-blue-400", "text-amber-400", "text-purple-400"];
const ENERGY_COLORS: Record<string, string> = {
  high: "bg-accent/15 text-accent",
  medium: "bg-warning/15 text-warning",
  low: "bg-blue-500/15 text-blue-400",
};
const PRIORITY_BADGES: Record<number, string> = {
  1: "bg-accent/15 text-accent",
  2: "bg-warning/15 text-warning",
  3: "bg-emerald-500/15 text-emerald-400",
};

interface TabOverviewProps {
  analysis: Record<string, unknown>;
  hostNames: string[];
}

export function TabOverview({ analysis, hostNames }: TabOverviewProps) {
  const [expandedMoments, setExpandedMoments] = useState<Set<number>>(new Set());

  const moments = (analysis.key_moments || []) as Array<Record<string, unknown>>;
  const clips = (analysis.clip_candidates || []) as Array<Record<string, unknown>>;
  const themes = (analysis.themes || []) as Array<Record<string, unknown>>;
  const quotes = (analysis.quotable_lines || []) as Array<Record<string, unknown>>;
  const segments = (analysis.topic_segments || []) as Array<Record<string, unknown>>;
  const angles = (analysis.content_angles || []) as Array<Record<string, unknown>>;
  const hostSummary = (analysis.host_clip_summary || {}) as Record<string, Record<string, number>>;

  function toggleMoment(i: number) {
    setExpandedMoments((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="sticky top-0 p-3 border-b border-border bg-bg-surface flex items-center gap-2">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Analysis Results</span>
        <div className="flex-1" />
        <span className="flex items-center gap-1.5 text-xs text-success">
          <CheckCircle2 size={14} /> Complete
        </span>
      </div>

      <div className="p-6 space-y-6">
        {/* Episode Summary */}
        {analysis.episode_summary ? (
          <div>
            <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted mb-2">Episode Summary</h4>
            <p className="text-sm text-text-secondary leading-relaxed">{analysis.episode_summary as string}</p>
          </div>
        ) : null}

        {/* Host Clip Summary */}
        {Object.keys(hostSummary).length > 0 && (
          <div>
            <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted mb-2">Clips by Host</h4>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(hostSummary).map(([host, stats], i) => (
                <div key={host} className="bg-bg-elevated border border-border rounded-lg p-3">
                  <div className={`text-sm font-semibold mb-1 ${SPEAKER_COLORS[i % SPEAKER_COLORS.length]}`}>{host}</div>
                  <div className="text-2xl font-display text-text-primary mb-1">{stats.total_clips}</div>
                  <div className="flex gap-2 text-[10px] text-text-muted">
                    <span className="text-accent">P1: {stats.priority_1}</span>
                    <span className="text-warning">P2: {stats.priority_2}</span>
                    <span className="text-emerald-400">P3: {stats.priority_3}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content Angles */}
        {angles.length > 0 && (
          <div>
            <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted mb-2">Content Angles</h4>
            <div className="space-y-1.5">
              {angles.map((angle, i) => (
                <div key={i} className="bg-accent/5 border border-accent/20 rounded-lg px-3 py-2 flex items-center justify-between">
                  <span className="text-sm text-text-secondary">
                    {typeof angle === "string" ? angle : (angle.angle as string)}
                  </span>
                  {typeof angle === "object" && angle.best_for ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-bg-elevated text-text-muted">{angle.best_for as string}</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key Moments */}
        {moments.length > 0 && (
          <div>
            <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted mb-2">
              Key Moments ({moments.length})
            </h4>
            <div className="space-y-2">
              {moments.map((moment, i) => (
                <div key={i} className="border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleMoment(i)}
                    className="w-full flex items-center gap-2 p-3 hover:bg-bg-elevated transition-colors text-left"
                  >
                    <Clock size={14} className="text-text-muted shrink-0" />
                    <span className="text-[11px] text-text-muted shrink-0">{moment.timestamp as string}</span>
                    {moment.host ? (
                      <span className={`text-[11px] font-medium ${SPEAKER_COLORS[hostNames.indexOf(moment.host as string) % SPEAKER_COLORS.length]}`}>
                        {moment.host as string}
                      </span>
                    ) : null}
                    <span className="text-sm text-text-primary flex-1">{moment.description as string}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ENERGY_COLORS[(moment.energy as string) || "medium"]}`}>
                      {moment.energy as string}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-bg-elevated text-text-muted">
                      {moment.type as string}
                    </span>
                    {expandedMoments.has(i) ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />}
                  </button>
                  {expandedMoments.has(i) && (
                    <div className="px-3 pb-3 text-[13px] text-text-secondary border-t border-border pt-2">
                      {moment.why_it_matters as string}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Clip Candidates */}
        {clips.length > 0 && (
          <div>
            <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted mb-2">
              Clip Candidates ({clips.length})
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {clips.map((clip, i) => {
                const priority = (clip.priority as number) || 3;
                const host = (clip.host || clip.speaker) as string;
                return (
                  <div key={i} className="border border-border rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Film size={14} className="text-accent" />
                      <span className="text-sm font-medium text-text-primary flex-1">{clip.title as string}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${PRIORITY_BADGES[priority]}`}>
                        P{priority}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-muted mb-1.5">
                      {host} &middot; ~{clip.estimated_duration_seconds as number}s
                    </p>
                    <p className="text-[12px] text-text-secondary italic mb-2">&ldquo;{clip.hook as string}&rdquo;</p>
                    <div className="flex flex-wrap gap-1">
                      {((clip.platforms || clip.platform || []) as string[]).map((p) => (
                        <span key={p} className="px-1.5 py-0.5 rounded text-[10px] bg-bg-elevated text-text-muted">{p}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Themes */}
        {themes.length > 0 && (
          <div>
            <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted mb-2">Themes</h4>
            <div className="flex flex-wrap gap-2">
              {themes.map((theme, i) => (
                <div key={i} className="bg-bg-elevated border border-border rounded-lg px-3 py-2">
                  <span className="text-sm font-medium text-text-primary">{theme.name as string}</span>
                  <p className="text-[11px] text-text-muted mt-0.5">{theme.summary as string}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quotable Lines */}
        {quotes.length > 0 && (
          <div>
            <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted mb-2">
              Quotable Lines ({quotes.length})
            </h4>
            <div className="space-y-2">
              {quotes.map((q, i) => (
                <div key={i} className="bg-bg-elevated rounded-lg p-3 border-l-2 border-accent/30">
                  <div className="flex items-start gap-2">
                    <Quote size={14} className="text-accent shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-text-primary italic">&ldquo;{q.quote as string}&rdquo;</p>
                      <p className="text-[11px] text-text-muted mt-1">
                        — {(q.host || q.speaker) as string} &middot; {q.context as string}
                      </p>
                      <div className="flex gap-1 mt-1.5">
                        {((q.platforms || []) as string[]).map((p) => (
                          <span key={p} className="px-1.5 py-0.5 rounded text-[10px] bg-bg-surface text-text-muted">{p}</span>
                        ))}
                      </div>
                    </div>
                    <CopyButton text={q.quote as string} label="" size="sm" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Topic Segments */}
        {segments.length > 0 && (
          <div>
            <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted mb-2">Topic Segments</h4>
            <div className="space-y-2">
              {segments.map((seg, i) => (
                <div key={i} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-text-primary">{seg.topic as string}</span>
                    <span className="text-[11px] text-text-muted">{seg.start_ref as string} — {seg.end_ref as string}</span>
                  </div>
                  <p className="text-[12px] text-text-secondary mb-1">{seg.summary as string}</p>
                  <p className="text-[11px] text-accent">Takeaway: {seg.key_takeaway as string}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
