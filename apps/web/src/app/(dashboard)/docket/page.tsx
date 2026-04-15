"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  GripVertical,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  MessageSquare,
  ArrowRight,
  Clock,
  Loader2,
  Lock,
  ListTodo,
  Sparkles,
  X,
  Link as LinkIcon,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import { useJobPoll } from "@/lib/hooks/use-job-poll";
import { StatusPill } from "@/components/ui/status-pill";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import type { DocketTopic, DocketTopicStatus } from "@godmodeprod/shared";

const STATUS_FILTERS = [
  { label: "All", value: null },
  { label: "Under Review", value: "under_review" },
  { label: "In", value: "in" },
  { label: "Out", value: "out" },
] as const;

function statusToPill(status: DocketTopicStatus) {
  if (status === "in") return "done" as const;
  if (status === "out") return "error" as const;
  return "in_progress" as const;
}

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] || url;
  }
}

function faviconFor(url: string): string {
  const host = hostnameFromUrl(url);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
}

function formatRecordingDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

type TopicWithCounts = DocketTopic & {
  docket_votes?: Array<{ vote: string }>;
  docket_comments?: [{ count: number }];
};

export default function DocketPage() {
  const router = useRouter();
  const { currentShow, currentEpisode, setCurrentEpisode } = useEpisodeStore();
  const [topics, setTopics] = useState<TopicWithCounts[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<TopicWithCounts | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [quickAddText, setQuickAddText] = useState("");
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Array<{ id: string; content: string; created_at: string }>>([]);
  const [lineupExpanded, setLineupExpanded] = useState(true);

  const { updateEpisodeStatus } = useEpisodeStore();
  const [summarising, setSummarising] = useState(false);
  const [summaryJobId, setSummaryJobId] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ summary: string; narrative_arc: string; title_options: string[] } | null>(null);

  const { status: summaryJobStatus } = useJobPoll({
    jobId: summaryJobId,
    enabled: summarising,
    onComplete: async () => {
      if (summaryJobId) {
        const res = await fetch(`/api/jobs/${summaryJobId}`);
        const json = await res.json();
        if (json.job?.result) setSummary(json.job.result);
      }
      setSummarising(false);
      setSummaryJobId(null);
    },
    onFailed: () => {
      setSummarising(false);
      setSummaryJobId(null);
    },
  });

  async function handleSummarise() {
    if (!currentShow || !currentEpisode) return;
    setSummarising(true);
    setSummary(null);
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        skillName: "docket-summarise",
        showId: currentShow.id,
        episodeId: currentEpisode.id,
        payload: {},
      }),
    });
    const json = await res.json();
    if (json.job) {
      setSummaryJobId(json.job.id);
    } else {
      setSummarising(false);
    }
  }

  // Auto-transition to docket_open when episode is in 'created' state
  useEffect(() => {
    if (currentEpisode && currentEpisode.status === "created") {
      updateEpisodeStatus(currentEpisode.id, "docket_open");
    }
  }, [currentEpisode, updateEpisodeStatus]);

  // Mobile-first: when no episode is selected, auto-select (and auto-create)
  // the latest episode for this show so phone users land on the right docket
  // with zero taps. Desktop users can still change via the episode dropdown.
  useEffect(() => {
    if (!currentShow || currentEpisode) return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/episodes/ensure-latest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showId: currentShow.id }),
      });
      if (!res.ok) return;
      const json = await res.json();
      if (!cancelled && json.episode) setCurrentEpisode(json.episode);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentShow, currentEpisode, setCurrentEpisode]);

  const fetchTopics = useCallback(async () => {
    if (!currentEpisode) return;
    setLoading(true);
    const params = new URLSearchParams({ episode_id: currentEpisode.id });
    if (filterStatus) params.set("status", filterStatus);
    const res = await fetch(`/api/docket/topics?${params}`);
    const json = await res.json();
    setTopics(json.topics || []);
    setLoading(false);
  }, [currentEpisode, filterStatus]);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  useEffect(() => {
    if (selectedTopic) {
      fetch(`/api/docket/comments?topic_id=${selectedTopic.id}`)
        .then((r) => r.json())
        .then((json) => setComments(json.comments || []));
    }
  }, [selectedTopic]);

  function isUrl(text: string): boolean {
    return /^https?:\/\//i.test(text.trim());
  }

  async function handleQuickAdd() {
    if (!quickAddText.trim() || !currentEpisode || !currentShow) return;
    setAdding(true);
    const inputText = quickAddText.trim();
    const isLink = isUrl(inputText);
    const isLocked = currentEpisode.status === "docket_locked";
    const res = await fetch("/api/docket/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        episodeId: currentEpisode.id,
        showId: currentShow.id,
        title: inputText,
        ...(isLink ? { originalUrl: inputText } : {}),
        ...(isLocked ? { autoIn: true } : {}),
      }),
    });
    const json = await res.json();
    if (json.topic) {
      setTopics((prev) => [...prev, json.topic]);
      setQuickAddText("");

      // Auto-enrich if input looks like a URL
      if (isLink) {
        fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            skillName: "docket-add",
            showId: currentShow.id,
            episodeId: currentEpisode.id,
            payload: {
              topicId: json.topic.id,
              showId: currentShow.id,
              episodeId: currentEpisode.id,
              url: inputText,
            },
          }),
        });
      }
    }
    setAdding(false);
  }

  async function updateTopicStatus(topicId: string, status: DocketTopicStatus) {
    const res = await fetch(`/api/docket/topics/${topicId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (json.topic) {
      setTopics((prev) => prev.map((t) => (t.id === topicId ? { ...t, ...json.topic } : t)));
      if (selectedTopic?.id === topicId) {
        setSelectedTopic({ ...selectedTopic, ...json.topic });
      }
    }
  }

  async function addComment() {
    if (!commentText.trim() || !selectedTopic) return;
    const res = await fetch("/api/docket/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topicId: selectedTopic.id,
        authorId: "00000000-0000-0000-0000-000000000000",
        content: commentText.trim(),
      }),
    });
    const json = await res.json();
    if (json.comment) {
      setComments((prev) => [...prev, json.comment]);
      setCommentText("");
    }
  }

  // --- Drag-to-reorder state (desktop only) ---
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const filtered = useMemo(
    () => topics.filter((t) => !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase())),
    [topics, searchQuery]
  );
  const lineupTopics = useMemo(
    () => topics.filter((t) => t.status === "in").sort((a, b) => a.sort_order - b.sort_order),
    [topics]
  );

  function handleDragStart(idx: number) {
    setDragIdx(idx);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setOverIdx(idx);
  }

  async function persistOrder(orderedIds: string[]) {
    await fetch("/api/docket/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    });
  }

  async function handleDrop(idx: number) {
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null);
      setOverIdx(null);
      return;
    }
    const reordered = [...lineupTopics];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(idx, 0, moved);
    const updatedTopics = topics.map((t) => {
      const newIdx = reordered.findIndex((r) => r.id === t.id);
      if (newIdx !== -1) return { ...t, sort_order: newIdx };
      return t;
    });
    setTopics(updatedTopics);
    setDragIdx(null);
    setOverIdx(null);
    await persistOrder(reordered.map((t) => t.id));
  }

  async function moveLineup(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= lineupTopics.length) return;
    const reordered = [...lineupTopics];
    [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];
    const updatedTopics = topics.map((t) => {
      const newIdx = reordered.findIndex((r) => r.id === t.id);
      if (newIdx !== -1) return { ...t, sort_order: newIdx };
      return t;
    });
    setTopics(updatedTopics);
    await persistOrder(reordered.map((t) => t.id));
  }

  function openTopic(topic: TopicWithCounts) {
    setSelectedTopic(topic);
    setMobileSheetOpen(true);
  }

  if (!currentEpisode) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <ListTodo size={40} strokeWidth={1} className="text-text-muted mb-3" />
        <h2 className="font-display text-2xl text-text-secondary mb-1">No Episode Selected</h2>
        <p className="text-sm text-text-muted">Select an episode from the top bar to manage its docket.</p>
      </div>
    );
  }

  const recordingLabel = formatRecordingDate(currentEpisode.recording_date);

  return (
    <div>
      {/* Page header — hidden on mobile to save space */}
      <div className="mb-6 hidden md:block">
        <h1 className="font-display text-5xl text-accent mb-1">DOCKET</h1>
        <p className="text-text-secondary text-sm">
          Capture, review, and vote on topics for EP{" "}
          {String(currentEpisode.episode_number).padStart(2, "0")}.
        </p>
      </div>

      {/* -------- MOBILE LAYOUT (<md) -------- */}
      <div className="md:hidden -mx-4 -mt-4">
        {/* Sticky top zone */}
        <div className="sticky top-0 z-20 bg-bg-surface/95 backdrop-blur border-b border-border">
          <div className="flex items-center justify-between px-4 py-2 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-display text-lg text-accent shrink-0">
                EP {String(currentEpisode.episode_number).padStart(2, "0")}
              </span>
              {recordingLabel && (
                <>
                  <span className="text-text-muted">·</span>
                  <span className="text-text-secondary truncate">{recordingLabel}</span>
                </>
              )}
            </div>
            <StatusPill
              status={currentEpisode.status === "docket_locked" ? "done" : "in_progress"}
              label={currentEpisode.status.replace(/_/g, " ")}
            />
          </div>

          {/* Capture input */}
          <div className="px-4 pb-2 flex gap-2">
            <input
              type="text"
              value={quickAddText}
              onChange={(e) => setQuickAddText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuickAdd()}
              placeholder="Paste link or type topic…"
              className="flex-1 bg-bg-elevated border border-border rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
            />
            <button
              onClick={handleQuickAdd}
              disabled={!quickAddText.trim() || adding}
              className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-md text-sm font-medium transition-colors"
            >
              {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            </button>
          </div>

          {/* Filter pills — horizontally scrollable */}
          <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto no-scrollbar">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.label}
                onClick={() => setFilterStatus(f.value)}
                className={`px-3 py-1 rounded-full text-[11px] font-medium uppercase tracking-wider transition-colors whitespace-nowrap shrink-0 ${
                  filterStatus === f.value
                    ? "bg-accent text-white"
                    : "bg-bg-elevated text-text-muted"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Inbox list */}
        <div className="px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-text-muted" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-text-muted text-sm">
              No topics yet. Paste a link above to start.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((topic) => (
                <MobileTopicCard
                  key={topic.id}
                  topic={topic}
                  onOpen={() => openTopic(topic)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Lineup collapsible */}
        <div className="mt-3 border-t border-border">
          <button
            onClick={() => setLineupExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
              In lineup ({lineupTopics.length})
            </span>
            {lineupExpanded ? (
              <ChevronUp size={16} className="text-text-muted" />
            ) : (
              <ChevronDown size={16} className="text-text-muted" />
            )}
          </button>

          {lineupExpanded && (
            <div className="px-4 pb-4">
              {lineupTopics.length === 0 ? (
                <p className="text-sm text-text-muted py-4 text-center">
                  Topics marked &quot;In&quot; will appear here.
                </p>
              ) : (
                <div className="space-y-2">
                  {lineupTopics.map((topic, i) => (
                    <div
                      key={topic.id}
                      className="bg-bg-surface border border-border rounded-lg p-3 flex items-center gap-2"
                    >
                      <span className="text-accent font-display text-lg w-5 text-center shrink-0">
                        {i + 1}
                      </span>
                      <button
                        onClick={() => openTopic(topic)}
                        className="flex-1 text-left min-w-0"
                      >
                        <span className="text-sm text-text-primary truncate block">
                          {topic.title}
                        </span>
                      </button>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => moveLineup(i, -1)}
                          disabled={i === 0}
                          className="p-1.5 rounded-md bg-bg-elevated text-text-muted hover:text-text-primary disabled:opacity-40 transition-colors"
                          aria-label="Move up"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          onClick={() => moveLineup(i, 1)}
                          disabled={i === lineupTopics.length - 1}
                          className="p-1.5 rounded-md bg-bg-elevated text-text-muted hover:text-text-primary disabled:opacity-40 transition-colors"
                          aria-label="Move down"
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Lineup footer actions */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                    <Clock size={12} /> Est. Time
                  </span>
                  <span className="font-mono text-text-secondary">
                    {lineupTopics.length * 8}–{lineupTopics.length * 12} min
                  </span>
                </div>
                {lineupTopics.length > 0 && currentEpisode.status !== "docket_locked" && (
                  <button
                    onClick={() => updateEpisodeStatus(currentEpisode.id, "docket_locked")}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-warning/15 text-warning text-sm font-medium hover:bg-warning/25 transition-colors"
                  >
                    <Lock size={14} /> Lock Docket
                  </button>
                )}
                {currentEpisode.status === "docket_locked" && (
                  <div className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-warning/10 text-warning/70 text-sm">
                    <Lock size={14} /> Docket Locked
                  </div>
                )}
                {lineupTopics.length > 0 && (
                  <button
                    onClick={handleSummarise}
                    disabled={summarising}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent/15 text-accent text-sm font-medium hover:bg-accent/25 transition-colors disabled:opacity-50"
                  >
                    {summarising ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        {summaryJobStatus === "running" ? "Summarising..." : "Queued..."}
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} /> Summarise
                      </>
                    )}
                  </button>
                )}
                {summary && (
                  <div className="p-3 rounded-lg bg-bg-surface border border-border space-y-2 mt-2">
                    <h4 className="text-[11px] font-medium uppercase tracking-wider text-text-muted">Summary</h4>
                    <p className="text-sm text-text-secondary leading-relaxed">{summary.summary}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mobile topic detail sheet */}
        <BottomSheet
          open={mobileSheetOpen && !!selectedTopic}
          onClose={() => setMobileSheetOpen(false)}
          title={selectedTopic?.title || ""}
        >
          {selectedTopic && (
            <div className="p-4 space-y-4">
              <StatusPill
                status={statusToPill(selectedTopic.status)}
                label={selectedTopic.status === "under_review" ? "Under Review" : selectedTopic.status}
              />
              {selectedTopic.original_url && (
                <a
                  href={selectedTopic.original_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-accent hover:border-accent/50 transition-colors"
                >
                  <ExternalLink size={14} />
                  <span className="truncate">{hostnameFromUrl(selectedTopic.original_url)}</span>
                </a>
              )}
              {selectedTopic.context && (
                <section>
                  <h3 className="text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
                    Context
                  </h3>
                  <p className="text-sm text-text-secondary">{selectedTopic.context}</p>
                </section>
              )}
              {selectedTopic.angle && (
                <section>
                  <h3 className="text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
                    Angle
                  </h3>
                  <p className="text-sm text-text-secondary">{selectedTopic.angle}</p>
                </section>
              )}
              {selectedTopic.sources && selectedTopic.sources.length > 0 && (
                <section>
                  <h3 className="text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
                    Sources
                  </h3>
                  <div className="space-y-1">
                    {selectedTopic.sources.map((s, i) => (
                      <a
                        key={i}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-accent hover:underline"
                      >
                        <ExternalLink size={12} />
                        <span className="truncate">{s.title || s.url}</span>
                      </a>
                    ))}
                  </div>
                </section>
              )}
              {comments.length > 0 && (
                <section>
                  <h3 className="text-[11px] font-medium uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1.5">
                    <MessageSquare size={12} />
                    Comments ({comments.length})
                  </h3>
                  <div className="space-y-2">
                    {comments.map((c) => (
                      <div key={c.id} className="bg-bg-elevated rounded-md p-2.5">
                        <p className="text-sm text-text-secondary">{c.content}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
          {/* Sticky action bar */}
          {selectedTopic && (
            <div className="sticky bottom-0 bg-bg-surface border-t border-border p-3 flex gap-2">
              <button
                onClick={() => {
                  updateTopicStatus(selectedTopic.id, "in");
                  setMobileSheetOpen(false);
                }}
                className="flex-1 py-2.5 rounded-md bg-success/15 text-success text-sm font-medium active:bg-success/25 transition-colors"
              >
                Mark In
              </button>
              <button
                onClick={() => {
                  updateTopicStatus(selectedTopic.id, "out");
                  setMobileSheetOpen(false);
                }}
                className="flex-1 py-2.5 rounded-md bg-error/15 text-error text-sm font-medium active:bg-error/25 transition-colors"
              >
                Mark Out
              </button>
              {selectedTopic.original_url && (
                <a
                  href={selectedTopic.original_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-md bg-accent/15 text-accent text-sm font-medium active:bg-accent/25 transition-colors"
                >
                  <ExternalLink size={14} /> Open
                </a>
              )}
            </div>
          )}
        </BottomSheet>
      </div>

      {/* -------- DESKTOP LAYOUT (md+) -------- */}
      <div className="hidden md:flex gap-4 h-[calc(100vh-220px)]">
        {/* Column 1: Topic Inbox (40%) */}
        <div className="w-[40%] flex flex-col bg-bg-surface border border-border rounded-lg overflow-hidden">
          {/* Filter bar */}
          <div className="p-3 border-b border-border space-y-2">
            <div className="flex gap-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.label}
                  onClick={() => setFilterStatus(f.value)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium uppercase tracking-wider transition-colors ${
                    filterStatus === f.value
                      ? "bg-accent text-white"
                      : "bg-bg-elevated text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search topics..."
                className="w-full bg-bg-elevated border border-border rounded-md pl-8 pr-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>

          {/* Topic list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin text-text-muted" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-text-muted text-sm">
                No topics yet. Add one below.
              </div>
            ) : (
              filtered.map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => setSelectedTopic(topic)}
                  className={`w-full text-left px-4 py-3 border-b border-border hover:bg-bg-elevated transition-colors ${
                    selectedTopic?.id === topic.id ? "bg-bg-elevated border-l-2 border-l-accent" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <GripVertical size={14} className="text-text-muted shrink-0 cursor-grab" />
                      <span className="text-sm text-text-primary truncate">{topic.title}</span>
                    </div>
                    <StatusPill status={statusToPill(topic.status)} label={topic.status === "under_review" ? "review" : topic.status} />
                  </div>
                  {topic.original_url && (
                    <div className="mt-1 ml-6">
                      <a
                        href={topic.original_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] text-accent/70 hover:text-accent truncate max-w-[280px]"
                      >
                        <LinkIcon size={10} className="shrink-0" />
                        {topic.original_url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 50)}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-1 ml-6 text-[11px] text-text-muted">
                    {topic.submitted_by && <span>by {topic.submitted_by}</span>}
                    {topic.sources && topic.sources.length > 0 && (
                      <span className="flex items-center gap-1">
                        <ExternalLink size={10} /> {topic.sources.length} source{topic.sources.length > 1 ? "s" : ""}
                      </span>
                    )}
                    {topic.docket_votes && topic.docket_votes.length > 0 && (
                      <span className="flex items-center gap-1">
                        <ThumbsUp size={10} />
                        {topic.docket_votes.filter((v) => v.vote === "up").length}
                        <ThumbsDown size={10} />
                        {topic.docket_votes.filter((v) => v.vote === "down").length}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Quick Add */}
          <div className="p-3 border-t border-border">
            <div className="flex gap-2">
              <input
                type="text"
                value={quickAddText}
                onChange={(e) => setQuickAddText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleQuickAdd()}
                placeholder="Paste link or type topic..."
                className="flex-1 bg-bg-elevated border border-border rounded-md px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
              />
              <button
                onClick={handleQuickAdd}
                disabled={!quickAddText.trim() || adding}
                className="px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-md text-sm font-medium transition-colors"
              >
                {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              </button>
            </div>
          </div>
        </div>

        {/* Column 2: Topic Detail (35%) */}
        <div className="w-[35%] bg-bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
          {selectedTopic ? (
            <>
              <div className="p-4 border-b border-border">
                <h2 className="text-lg font-semibold text-text-primary mb-2">
                  {selectedTopic.title}
                </h2>
                <StatusPill
                  status={statusToPill(selectedTopic.status)}
                  label={selectedTopic.status === "under_review" ? "Under Review" : selectedTopic.status}
                />
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {selectedTopic.original_url && (
                  <div>
                    <h3 className="text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
                      Original Link
                    </h3>
                    <a
                      href={selectedTopic.original_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline break-all"
                    >
                      <ExternalLink size={12} className="shrink-0" />
                      {selectedTopic.original_url}
                    </a>
                  </div>
                )}
                {selectedTopic.context && (
                  <div>
                    <h3 className="text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
                      Context
                    </h3>
                    <p className="text-sm text-text-secondary">{selectedTopic.context}</p>
                  </div>
                )}
                {selectedTopic.angle && (
                  <div>
                    <h3 className="text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
                      Angle
                    </h3>
                    <p className="text-sm text-text-secondary">{selectedTopic.angle}</p>
                  </div>
                )}
                {selectedTopic.sources && selectedTopic.sources.length > 0 && (
                  <div>
                    <h3 className="text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
                      Sources
                    </h3>
                    <div className="space-y-1">
                      {selectedTopic.sources.map((s, i) => (
                        <a
                          key={i}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-accent hover:underline"
                        >
                          <ExternalLink size={12} />
                          {s.title || s.url}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Comments */}
                <div>
                  <h3 className="text-[11px] font-medium uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1.5">
                    <MessageSquare size={12} />
                    Comments ({comments.length})
                  </h3>
                  <div className="space-y-2 mb-3">
                    {comments.map((c) => (
                      <div key={c.id} className="bg-bg-elevated rounded-md p-2.5">
                        <p className="text-sm text-text-secondary">{c.content}</p>
                        <span className="text-[11px] text-text-muted mt-1 block">
                          {new Date(c.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addComment()}
                      placeholder="Add a comment..."
                      className="flex-1 bg-bg-elevated border border-border rounded-md px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                    />
                    <button
                      onClick={addComment}
                      disabled={!commentText.trim()}
                      className="px-3 py-1.5 bg-bg-elevated border border-border hover:border-accent text-text-secondary text-sm rounded-md transition-colors disabled:opacity-50"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>

              {/* Action bar */}
              <div className="p-3 border-t border-border flex gap-2">
                <button
                  onClick={() => updateTopicStatus(selectedTopic.id, "in")}
                  className="flex-1 py-2 rounded-md bg-success/15 text-success text-sm font-medium hover:bg-success/25 transition-colors"
                >
                  Mark In
                </button>
                <button
                  onClick={() => updateTopicStatus(selectedTopic.id, "out")}
                  className="flex-1 py-2 rounded-md bg-error/15 text-error text-sm font-medium hover:bg-error/25 transition-colors"
                >
                  Mark Out
                </button>
                <button
                  onClick={() => router.push("/research")}
                  className="flex items-center justify-center gap-1.5 flex-1 py-2 rounded-md bg-accent/15 text-accent text-sm font-medium hover:bg-accent/25 transition-colors"
                >
                  <ArrowRight size={14} /> Research
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-text-muted text-sm">
              Select a topic to see details
            </div>
          )}
        </div>

        {/* Column 3: Episode Lineup (25%) */}
        <div className="w-[25%] bg-bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
          <div className="p-3 border-b border-border">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
              Episode Lineup
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto">
            {lineupTopics.length === 0 ? (
              <div className="text-center py-8 text-text-muted text-sm px-4">
                Topics marked &quot;In&quot; will appear here.
              </div>
            ) : (
              lineupTopics.map((topic, i) => (
                <div
                  key={topic.id}
                  draggable
                  onDragStart={() => handleDragStart(i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDrop={() => handleDrop(i)}
                  onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                  onClick={() => setSelectedTopic(topic)}
                  className={`px-3 py-2.5 border-b border-border flex items-center gap-2 hover:bg-bg-elevated transition-colors cursor-grab group ${
                    dragIdx === i ? "opacity-40" : ""
                  } ${overIdx === i && dragIdx !== i ? "border-t-2 border-t-accent" : ""} ${
                    selectedTopic?.id === topic.id ? "bg-bg-elevated" : ""
                  }`}
                >
                  <GripVertical size={14} className="text-text-muted shrink-0" />
                  <span className="text-accent font-display text-lg">{i + 1}</span>
                  <span className="text-sm text-text-primary truncate flex-1">{topic.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateTopicStatus(topic.id, "under_review");
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-error/20 text-text-muted hover:text-error transition-all shrink-0"
                    title="Remove from lineup"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Time estimate + Lock */}
          <div className="p-3 border-t border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <Clock size={12} /> Est. Time
              </span>
              <span className="text-sm font-mono text-text-secondary">
                {lineupTopics.length * 8}–{lineupTopics.length * 12} min
              </span>
            </div>
            {lineupTopics.length > 0 && currentEpisode.status !== "docket_locked" && (
              <button
                onClick={() => updateEpisodeStatus(currentEpisode.id, "docket_locked")}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-warning/15 text-warning text-sm font-medium hover:bg-warning/25 transition-colors"
              >
                <Lock size={14} /> Lock Docket
              </button>
            )}
            {currentEpisode.status === "docket_locked" && (
              <div className="flex items-center justify-center gap-2 py-2 rounded-lg bg-warning/10 text-warning/70 text-sm">
                <Lock size={14} /> Docket Locked
              </div>
            )}
            {lineupTopics.length > 0 && (
              <button
                onClick={handleSummarise}
                disabled={summarising}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-accent/15 text-accent text-sm font-medium hover:bg-accent/25 transition-colors disabled:opacity-50"
              >
                {summarising ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {summaryJobStatus === "running" ? "Summarising..." : "Queued..."}
                  </>
                ) : (
                  <>
                    <Sparkles size={14} /> Summarise
                  </>
                )}
              </button>
            )}
          </div>

          {/* Summary result */}
          {summary && (
            <div className="p-3 border-t border-border space-y-2 max-h-60 overflow-y-auto">
              <h4 className="text-[11px] font-medium uppercase tracking-wider text-text-muted">Summary</h4>
              <p className="text-sm text-text-secondary leading-relaxed">{summary.summary}</p>
              {summary.narrative_arc && (
                <>
                  <h4 className="text-[11px] font-medium uppercase tracking-wider text-text-muted mt-2">Arc</h4>
                  <p className="text-xs text-text-muted leading-relaxed">{summary.narrative_arc}</p>
                </>
              )}
              {summary.title_options && summary.title_options.length > 0 && (
                <>
                  <h4 className="text-[11px] font-medium uppercase tracking-wider text-text-muted mt-2">Title Ideas</h4>
                  <ul className="space-y-1">
                    {summary.title_options.map((t, i) => (
                      <li key={i} className="text-xs text-accent">{t}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MobileTopicCard({ topic, onOpen }: { topic: TopicWithCounts; onOpen: () => void }) {
  const hasImage = !!topic.original_image_url;
  const hasUrl = !!topic.original_url;
  const contextSnippet = topic.context
    ? topic.context.length > 120
      ? topic.context.slice(0, 117) + "…"
      : topic.context
    : "";

  return (
    <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
      <button
        onClick={onOpen}
        className="w-full text-left p-3 active:bg-bg-elevated transition-colors"
      >
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 className="text-[15px] font-medium text-text-primary leading-snug min-w-0">
            {topic.title}
          </h3>
          <StatusPill
            status={statusToPill(topic.status)}
            label={topic.status === "under_review" ? "review" : topic.status}
          />
        </div>
        {contextSnippet && (
          <p className="text-[13px] text-text-secondary leading-relaxed">{contextSnippet}</p>
        )}
        {topic.submitted_by && (
          <p className="text-[11px] text-text-muted mt-1.5">by {topic.submitted_by}</p>
        )}
      </button>

      {hasUrl && (
        <a
          href={topic.original_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 border-t border-border bg-bg-elevated/40 active:bg-bg-elevated transition-colors"
        >
          {hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={topic.original_image_url!}
              alt=""
              className="w-12 h-12 rounded object-cover shrink-0 bg-bg-elevated"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={faviconFor(topic.original_url)}
              alt=""
              className="w-4 h-4 shrink-0"
            />
          )}
          <span className="text-[12px] text-text-secondary truncate flex-1">
            {hostnameFromUrl(topic.original_url)}
          </span>
          <ExternalLink size={14} className="text-text-muted shrink-0" />
        </a>
      )}
    </div>
  );
}
