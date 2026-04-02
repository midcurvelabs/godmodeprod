"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Upload,
  Loader2,
  CheckCircle2,
  Circle,
  Copy,
  FileText,
  ChevronDown,
  ChevronRight,
  Zap,
  PenLine,
  Clock,
  Quote,
  Film,
  Hash,
  Sparkles,
  RefreshCw,
  Check,
} from "lucide-react";
import { useEpisodeStore } from "@/lib/stores/episode-store";

// --- Types ---

type PipelineStep = "upload" | "ingest" | "analyze" | "write" | "done";
type RightPanelView = "transcript" | "analysis" | "outputs";

interface TranscriptData {
  id: string;
  episode_id: string;
  raw_content: string;
  clean_content: string | null;
  speaker_tags: Record<string, { line_count: number; word_count: number; first_appearance?: string }> | null;
  word_count: number;
  status: string;
  uploaded_at: string;
}

interface MasterAnalysis {
  key_moments?: Array<{
    timestamp: string;
    description: string;
    why_it_matters: string;
    energy: string;
    type: string;
  }>;
  clip_candidates?: Array<{
    title: string;
    hook: string;
    speaker: string;
    start_ref: string;
    end_ref: string;
    platform: string[];
    estimated_duration_seconds: number;
    why_it_works: string;
  }>;
  themes?: Array<{
    name: string;
    summary: string;
  }>;
  quotable_lines?: Array<{
    quote: string;
    speaker: string;
    context: string;
    platforms: string[];
  }>;
  topic_segments?: Array<{
    topic: string;
    start_ref: string;
    end_ref: string;
    summary: string;
    key_takeaway: string;
  }>;
  episode_summary?: string;
  content_angles?: string[];
}

interface RepurposeOutput {
  id: string;
  episode_id: string;
  output_type: string;
  content: Record<string, unknown>;
  host_id: string | null;
  status: string;
  generated_at: string;
}

// --- Constants ---

const PIPELINE_STEPS: { key: PipelineStep; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "ingest", label: "Ingest" },
  { key: "analyze", label: "Analyze" },
  { key: "write", label: "Write" },
  { key: "done", label: "Done" },
];

const SPEAKER_COLORS = [
  "text-accent",
  "text-emerald-400",
  "text-blue-400",
  "text-amber-400",
  "text-purple-400",
];

const ENERGY_COLORS: Record<string, string> = {
  high: "bg-accent/15 text-accent",
  medium: "bg-warning/15 text-warning",
  low: "bg-blue-500/15 text-blue-400",
};

const OUTPUT_TYPE_LABELS: Record<string, { label: string; icon: typeof Copy }> = {
  twitter: { label: "Twitter Threads", icon: Hash },
  linkedin: { label: "LinkedIn Posts", icon: PenLine },
  captions: { label: "Captions (YT + IG)", icon: FileText },
  youtube_segments: { label: "YouTube Chapters", icon: Film },
  schedule: { label: "Posting Schedule", icon: Clock },
  clip_timestamps: { label: "Clip Timestamps", icon: Film },
};

function getPipelineStep(
  transcript: TranscriptData | null,
  hasMaster: boolean,
  hasOutputs: boolean
): PipelineStep {
  if (!transcript) return "upload";
  if (transcript.status === "pending") return "ingest";
  if (transcript.status === "processed" && !hasMaster) return "analyze";
  if (hasMaster && !hasOutputs) return "write";
  if (hasOutputs) return "done";
  return "analyze";
}

// --- Component ---

export default function RepurposePage() {
  const { currentShow, currentEpisode } = useEpisodeStore();

  // Transcript state
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [rawInput, setRawInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [transcriptProcessing, setTranscriptProcessing] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  // Analysis state
  const [masterAnalysis, setMasterAnalysis] = useState<RepurposeOutput | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Outputs state
  const [outputs, setOutputs] = useState<RepurposeOutput[]>([]);
  const [generating, setGenerating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  // UI state
  const [rightPanel, setRightPanel] = useState<RightPanelView>("transcript");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedMoments, setExpandedMoments] = useState<Set<number>>(new Set());

  const currentStep = getPipelineStep(transcript, !!masterAnalysis, outputs.length > 0);

  // --- Data Fetching ---

  const fetchTranscript = useCallback(async () => {
    if (!currentEpisode) return;
    const res = await fetch(`/api/transcripts?episode_id=${currentEpisode.id}`);
    const json = await res.json();
    if (json.transcript) {
      setTranscript(json.transcript);
      if (json.transcript.status === "pending") setTranscriptProcessing(true);
    }
  }, [currentEpisode]);

  const fetchRepurposeData = useCallback(async () => {
    if (!currentEpisode) return;
    const res = await fetch(`/api/repurpose?episode_id=${currentEpisode.id}`);
    const json = await res.json();
    if (json.master) {
      setMasterAnalysis(json.master);
      setRightPanel("analysis");
    }
    if (json.outputs?.length > 0) {
      setOutputs(json.outputs);
      setRightPanel("outputs");
    }
  }, [currentEpisode]);

  useEffect(() => {
    fetchTranscript();
    fetchRepurposeData();
  }, [fetchTranscript, fetchRepurposeData]);

  // Poll for transcript processing
  useEffect(() => {
    if (!transcriptProcessing || !currentEpisode) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/transcripts?episode_id=${currentEpisode.id}`);
      const json = await res.json();
      if (json.transcript?.status === "processed") {
        setTranscript(json.transcript);
        setTranscriptProcessing(false);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [transcriptProcessing, currentEpisode]);

  // Poll for analysis completion
  useEffect(() => {
    if (!analyzing || !currentEpisode) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/repurpose?episode_id=${currentEpisode.id}`);
      const json = await res.json();
      if (json.master) {
        setMasterAnalysis(json.master);
        setAnalyzing(false);
        setRightPanel("analysis");
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [analyzing, currentEpisode]);

  // Poll for content generation completion
  useEffect(() => {
    if (!generating || !currentEpisode) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/repurpose?episode_id=${currentEpisode.id}`);
      const json = await res.json();
      if (json.outputs?.length > 0) {
        setOutputs(json.outputs);
        setGenerating(false);
        setRightPanel("outputs");
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [generating, currentEpisode]);

  // --- Actions ---

  async function handleUpload() {
    if (!currentShow || !currentEpisode || !rawInput.trim()) return;
    setUploading(true);
    const res = await fetch("/api/transcripts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        episodeId: currentEpisode.id,
        showId: currentShow.id,
        rawContent: rawInput.trim(),
      }),
    });
    const json = await res.json();
    if (json.transcript) {
      setTranscript(json.transcript);
      setRawInput("");
      setTranscriptProcessing(true);
    }
    setUploading(false);
  }

  async function handleAnalyze() {
    if (!currentShow || !currentEpisode) return;
    setAnalyzing(true);
    await fetch("/api/repurpose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "analyze",
        episodeId: currentEpisode.id,
        showId: currentShow.id,
      }),
    });
  }

  async function handleGenerateContent() {
    if (!currentShow || !currentEpisode) return;
    setGenerating(true);
    await fetch("/api/repurpose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "write",
        episodeId: currentEpisode.id,
        showId: currentShow.id,
      }),
    });
  }

  async function handleHumanize(outputId: string) {
    if (!currentShow || !currentEpisode) return;
    await fetch("/api/repurpose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "humanize",
        episodeId: currentEpisode.id,
        showId: currentShow.id,
        outputId,
      }),
    });
  }

  async function handleApprove(outputId: string) {
    await fetch(`/api/repurpose/${outputId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    setOutputs((prev) => prev.map((o) => (o.id === outputId ? { ...o, status: "approved" } : o)));
  }

  async function handleSaveEdit(outputId: string) {
    try {
      const parsed = JSON.parse(editContent);
      await fetch(`/api/repurpose/${outputId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: parsed }),
      });
      setOutputs((prev) => prev.map((o) => (o.id === outputId ? { ...o, content: parsed } : o)));
    } catch {
      // If not valid JSON, save as raw text wrapper
      await fetch(`/api/repurpose/${outputId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: { text: editContent } }),
      });
      setOutputs((prev) => prev.map((o) => (o.id === outputId ? { ...o, content: { text: editContent } } : o)));
    }
    setEditingId(null);
    setEditContent("");
  }

  function copyContent(content: Record<string, unknown>, id: string) {
    const text = typeof content === "string" ? content : JSON.stringify(content, null, 2);
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // --- Guards ---

  if (!currentEpisode) {
    return (
      <div className="text-center py-16 text-text-muted">
        <p className="text-sm">Select an episode from the top bar to start repurposing.</p>
      </div>
    );
  }

  const speakerNames = transcript?.speaker_tags ? Object.keys(transcript.speaker_tags) : [];
  const analysis = masterAnalysis?.content as MasterAnalysis | undefined;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-5xl text-accent mb-1">REPURPOSE ENGINE</h1>
        <p className="text-text-secondary text-sm">
          Transform transcript into content for every platform.
        </p>
      </div>

      {/* Pipeline Status */}
      <div className="flex items-center gap-1 mb-6 bg-bg-surface border border-border rounded-lg px-4 py-3">
        {PIPELINE_STEPS.map((step, i) => {
          const stepIndex = PIPELINE_STEPS.findIndex((s) => s.key === currentStep);
          const thisIndex = i;
          const isDone = thisIndex < stepIndex || currentStep === "done";
          const isActive = thisIndex === stepIndex && currentStep !== "done";

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
              {i < PIPELINE_STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-2 ${isDone ? "bg-success/50" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="flex gap-4 h-[calc(100vh-280px)]">
        {/* Left Panel (35%) */}
        <div className="w-[35%] bg-bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
          {!transcript ? (
            /* Upload Panel */
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-border">
                <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted mb-1">
                  Paste Transcript
                </h3>
                <p className="text-[11px] text-text-muted">
                  Paste the raw recording transcript below.
                </p>
              </div>
              <div className="flex-1 p-4">
                <textarea
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                  placeholder="Paste your raw transcript here..."
                  className="w-full h-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-none font-mono text-[13px] leading-relaxed"
                />
              </div>
              <div className="p-4 border-t border-border">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] text-text-muted">
                    {rawInput.trim() ? `${rawInput.trim().split(/\s+/).length.toLocaleString()} words` : "No content"}
                  </span>
                </div>
                {uploading ? (
                  <div className="text-center py-2">
                    <Loader2 size={18} className="animate-spin text-accent mx-auto mb-1" />
                    <p className="text-xs text-text-secondary">Uploading...</p>
                  </div>
                ) : (
                  <button
                    onClick={handleUpload}
                    disabled={!rawInput.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
                  >
                    <Upload size={16} /> Upload & Process
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Transcript Info + Actions */
            <div className="flex flex-col h-full overflow-y-auto">
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
                    Transcript
                  </h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                    transcript.status === "processed" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                  }`}>
                    {transcript.status}
                  </span>
                </div>
                {transcriptProcessing && (
                  <div className="flex items-center gap-2 mt-2">
                    <Loader2 size={14} className="animate-spin text-accent" />
                    <span className="text-xs text-text-secondary">Processing transcript...</span>
                  </div>
                )}
              </div>

              {/* Speaker Stats */}
              {speakerNames.length > 0 && (
                <div className="p-4 border-b border-border">
                  <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted mb-2">Speakers</h4>
                  <div className="space-y-1.5">
                    {speakerNames.map((name, i) => {
                      const stats = transcript.speaker_tags![name];
                      return (
                        <div key={name} className="flex items-center justify-between">
                          <span className={`text-sm font-medium ${SPEAKER_COLORS[i % SPEAKER_COLORS.length]}`}>{name}</span>
                          <span className="text-[11px] text-text-muted">{stats.word_count?.toLocaleString() || 0} words</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Word Count */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-text-secondary">
                    <FileText size={14} />
                    <span className="text-sm">{transcript.word_count?.toLocaleString() || 0} words</span>
                  </div>
                  <button
                    onClick={() => {
                      if (transcript.clean_content) {
                        navigator.clipboard.writeText(transcript.clean_content);
                        setCopiedId("transcript");
                        setTimeout(() => setCopiedId(null), 2000);
                      }
                    }}
                    disabled={!transcript.clean_content}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
                  >
                    <Copy size={12} /> {copiedId === "transcript" ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              {/* View Toggles */}
              <div className="p-4 border-b border-border space-y-1">
                <button
                  onClick={() => setShowRaw(!showRaw)}
                  className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
                >
                  {showRaw ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  {showRaw ? "Hide" : "Show"} raw transcript
                </button>
              </div>

              {/* Panel Navigation */}
              {transcript.status === "processed" && (
                <div className="p-4 border-b border-border">
                  <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted mb-2">View</h4>
                  <div className="flex gap-1">
                    {(["transcript", "analysis", "outputs"] as RightPanelView[]).map((view) => (
                      <button
                        key={view}
                        onClick={() => setRightPanel(view)}
                        disabled={
                          (view === "analysis" && !masterAnalysis) ||
                          (view === "outputs" && outputs.length === 0)
                        }
                        className={`px-2.5 py-1 rounded text-xs font-medium transition-colors capitalize ${
                          rightPanel === view
                            ? "bg-accent/15 text-accent"
                            : "text-text-muted hover:text-text-secondary disabled:opacity-30 disabled:cursor-not-allowed"
                        }`}
                      >
                        {view}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="p-4 mt-auto space-y-2">
                {transcript.status === "processed" && !masterAnalysis && !analyzing && (
                  <button
                    onClick={handleAnalyze}
                    className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
                  >
                    <Zap size={16} /> Run Analysis
                  </button>
                )}
                {analyzing && (
                  <div className="text-center py-2">
                    <Loader2 size={18} className="animate-spin text-accent mx-auto mb-1" />
                    <p className="text-xs text-text-secondary">Analyzing transcript...</p>
                  </div>
                )}
                {masterAnalysis && outputs.length === 0 && !generating && (
                  <button
                    onClick={handleGenerateContent}
                    className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
                  >
                    <Sparkles size={16} /> Generate Content
                  </button>
                )}
                {generating && (
                  <div className="text-center py-2">
                    <Loader2 size={18} className="animate-spin text-accent mx-auto mb-1" />
                    <p className="text-xs text-text-secondary">Generating content...</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel (65%) */}
        <div className="w-[65%] bg-bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
          {!transcript ? (
            <div className="flex-1 flex items-center justify-center text-text-muted">
              <div className="text-center">
                <Upload size={32} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm mb-1">No transcript uploaded yet.</p>
                <p className="text-[11px]">Paste your recording transcript on the left to get started.</p>
              </div>
            </div>
          ) : transcriptProcessing ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Loader2 size={32} className="animate-spin text-accent mx-auto mb-3" />
                <p className="text-sm text-text-secondary mb-1">Processing transcript...</p>
                <p className="text-[11px] text-text-muted">Cleaning, tagging speakers, and normalizing formatting.</p>
              </div>
            </div>
          ) : rightPanel === "transcript" ? (
            /* Transcript View */
            <div className="flex-1 overflow-y-auto">
              <div className="sticky top-0 p-3 border-b border-border bg-bg-surface flex items-center gap-2">
                <button
                  onClick={() => {
                    if (transcript.clean_content) {
                      navigator.clipboard.writeText(transcript.clean_content);
                      setCopiedId("transcript-main");
                      setTimeout(() => setCopiedId(null), 2000);
                    }
                  }}
                  disabled={!transcript.clean_content}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-elevated border border-border text-text-secondary text-sm hover:text-text-primary hover:border-text-muted transition-colors disabled:opacity-50"
                >
                  <Copy size={14} /> {copiedId === "transcript-main" ? "Copied!" : "Copy All"}
                </button>
                <div className="flex-1" />
                {transcript.status === "processed" && (
                  <span className="flex items-center gap-1.5 text-xs text-success">
                    <CheckCircle2 size={14} /> Processed
                  </span>
                )}
              </div>
              <div className="p-6">
                {showRaw && (
                  <div className="mb-6">
                    <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted mb-2">Raw Transcript</h4>
                    <div className="bg-bg-elevated border border-border rounded-lg p-4 text-sm text-text-secondary font-mono text-[13px] leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                      {transcript.raw_content}
                    </div>
                  </div>
                )}
                {transcript.clean_content ? (
                  <div>
                    <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted mb-2">Clean Transcript</h4>
                    <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                      {transcript.clean_content.split("\n").map((line, i) => {
                        const speakerMatch = line.match(/^\[([^\]]+)\]:/);
                        if (speakerMatch) {
                          const speakerName = speakerMatch[1];
                          const speakerIndex = speakerNames.indexOf(speakerName);
                          const colorClass = SPEAKER_COLORS[speakerIndex >= 0 ? speakerIndex % SPEAKER_COLORS.length : 0];
                          return (
                            <p key={i} className="mb-2">
                              <span className={`font-semibold ${colorClass}`}>[{speakerName}]:</span>
                              {line.slice(speakerMatch[0].length)}
                            </p>
                          );
                        }
                        return line.trim() ? <p key={i} className="mb-2">{line}</p> : <br key={i} />;
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-text-muted">
                    <p className="text-sm">Transcript uploaded but not yet processed.</p>
                  </div>
                )}
              </div>
            </div>
          ) : rightPanel === "analysis" && analysis ? (
            /* Analysis View */
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
                {analysis.episode_summary && (
                  <div>
                    <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted mb-2">Episode Summary</h4>
                    <p className="text-sm text-text-secondary leading-relaxed">{analysis.episode_summary}</p>
                  </div>
                )}

                {/* Content Angles */}
                {analysis.content_angles && analysis.content_angles.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted mb-2">Content Angles</h4>
                    <div className="space-y-1.5">
                      {analysis.content_angles.map((angle, i) => (
                        <div key={i} className="bg-accent/5 border border-accent/20 rounded-lg px-3 py-2 text-sm text-text-secondary">
                          {angle}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Moments */}
                {analysis.key_moments && analysis.key_moments.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted mb-2">
                      Key Moments ({analysis.key_moments.length})
                    </h4>
                    <div className="space-y-2">
                      {analysis.key_moments.map((moment, i) => (
                        <div key={i} className="border border-border rounded-lg overflow-hidden">
                          <button
                            onClick={() => {
                              setExpandedMoments((prev) => {
                                const next = new Set(prev);
                                if (next.has(i)) next.delete(i);
                                else next.add(i);
                                return next;
                              });
                            }}
                            className="w-full flex items-center gap-2 p-3 hover:bg-bg-elevated transition-colors text-left"
                          >
                            <Clock size={14} className="text-text-muted shrink-0" />
                            <span className="text-[11px] text-text-muted shrink-0">{moment.timestamp}</span>
                            <span className="text-sm text-text-primary flex-1">{moment.description}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ENERGY_COLORS[moment.energy] || ENERGY_COLORS.medium}`}>
                              {moment.energy}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-bg-elevated text-text-muted">
                              {moment.type}
                            </span>
                            {expandedMoments.has(i) ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />}
                          </button>
                          {expandedMoments.has(i) && (
                            <div className="px-3 pb-3 text-[13px] text-text-secondary border-t border-border pt-2">
                              {moment.why_it_matters}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Clip Candidates */}
                {analysis.clip_candidates && analysis.clip_candidates.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted mb-2">
                      Clip Candidates ({analysis.clip_candidates.length})
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {analysis.clip_candidates.map((clip, i) => (
                        <div key={i} className="border border-border rounded-lg p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Film size={14} className="text-accent" />
                            <span className="text-sm font-medium text-text-primary">{clip.title}</span>
                          </div>
                          <p className="text-[11px] text-text-muted mb-1.5">
                            {clip.speaker} &middot; ~{clip.estimated_duration_seconds}s
                          </p>
                          <p className="text-[12px] text-text-secondary italic mb-2">&ldquo;{clip.hook}&rdquo;</p>
                          <div className="flex flex-wrap gap-1">
                            {clip.platform.map((p) => (
                              <span key={p} className="px-1.5 py-0.5 rounded text-[10px] bg-bg-elevated text-text-muted">{p}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Themes */}
                {analysis.themes && analysis.themes.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted mb-2">Themes</h4>
                    <div className="flex flex-wrap gap-2">
                      {analysis.themes.map((theme, i) => (
                        <div key={i} className="bg-bg-elevated border border-border rounded-lg px-3 py-2">
                          <span className="text-sm font-medium text-text-primary">{theme.name}</span>
                          <p className="text-[11px] text-text-muted mt-0.5">{theme.summary}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quotable Lines */}
                {analysis.quotable_lines && analysis.quotable_lines.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted mb-2">
                      Quotable Lines ({analysis.quotable_lines.length})
                    </h4>
                    <div className="space-y-2">
                      {analysis.quotable_lines.map((q, i) => (
                        <div key={i} className="bg-bg-elevated rounded-lg p-3 border-l-2 border-accent/30">
                          <div className="flex items-start gap-2">
                            <Quote size={14} className="text-accent shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm text-text-primary italic">&ldquo;{q.quote}&rdquo;</p>
                              <p className="text-[11px] text-text-muted mt-1">
                                — {q.speaker} &middot; {q.context}
                              </p>
                              <div className="flex gap-1 mt-1.5">
                                {q.platforms.map((p) => (
                                  <span key={p} className="px-1.5 py-0.5 rounded text-[10px] bg-bg-surface text-text-muted">{p}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Topic Segments */}
                {analysis.topic_segments && analysis.topic_segments.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted mb-2">Topic Segments</h4>
                    <div className="space-y-2">
                      {analysis.topic_segments.map((seg, i) => (
                        <div key={i} className="border border-border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-text-primary">{seg.topic}</span>
                            <span className="text-[11px] text-text-muted">{seg.start_ref} — {seg.end_ref}</span>
                          </div>
                          <p className="text-[12px] text-text-secondary mb-1">{seg.summary}</p>
                          <p className="text-[11px] text-accent">Takeaway: {seg.key_takeaway}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : rightPanel === "outputs" && outputs.length > 0 ? (
            /* Outputs View */
            <div className="flex-1 overflow-y-auto">
              <div className="sticky top-0 p-3 border-b border-border bg-bg-surface flex items-center gap-2">
                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Generated Content</span>
                <div className="flex-1" />
                <span className="text-xs text-text-muted">
                  {outputs.filter((o) => o.status === "approved").length}/{outputs.length} approved
                </span>
              </div>
              <div className="p-6 grid grid-cols-2 gap-4">
                {outputs.map((output) => {
                  const typeInfo = OUTPUT_TYPE_LABELS[output.output_type] || {
                    label: output.output_type,
                    icon: FileText,
                  };
                  const Icon = typeInfo.icon;
                  const isEditing = editingId === output.id;
                  const contentStr = typeof output.content === "string"
                    ? output.content
                    : JSON.stringify(output.content, null, 2);

                  return (
                    <div key={output.id} className="border border-border rounded-lg overflow-hidden flex flex-col">
                      {/* Card Header */}
                      <div className="p-3 border-b border-border flex items-center gap-2">
                        <Icon size={14} className="text-accent" />
                        <span className="text-sm font-medium text-text-primary flex-1">{typeInfo.label}</span>
                        {output.status === "approved" && (
                          <span className="flex items-center gap-1 text-[10px] text-success font-medium">
                            <Check size={12} /> Approved
                          </span>
                        )}
                      </div>

                      {/* Card Content */}
                      <div className="p-3 flex-1 max-h-[200px] overflow-y-auto">
                        {isEditing ? (
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full h-full min-h-[150px] bg-bg-elevated border border-border rounded px-2 py-1.5 text-[12px] text-text-primary font-mono resize-none focus:outline-none focus:border-accent"
                          />
                        ) : (
                          <pre className="text-[12px] text-text-secondary whitespace-pre-wrap break-words font-mono leading-relaxed">
                            {contentStr.slice(0, 500)}
                            {contentStr.length > 500 && "..."}
                          </pre>
                        )}
                      </div>

                      {/* Card Actions */}
                      <div className="p-2 border-t border-border flex items-center gap-1">
                        <button
                          onClick={() => copyContent(output.content, output.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-text-muted hover:text-text-secondary transition-colors"
                        >
                          <Copy size={11} /> {copiedId === output.id ? "Copied!" : "Copy"}
                        </button>
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleSaveEdit(output.id)}
                              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-success hover:text-success/80 transition-colors"
                            >
                              <Check size={11} /> Save
                            </button>
                            <button
                              onClick={() => { setEditingId(null); setEditContent(""); }}
                              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-text-muted hover:text-text-secondary transition-colors"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => { setEditingId(output.id); setEditContent(contentStr); }}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-text-muted hover:text-text-secondary transition-colors"
                          >
                            <PenLine size={11} /> Edit
                          </button>
                        )}
                        <button
                          onClick={() => handleHumanize(output.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-text-muted hover:text-text-secondary transition-colors"
                        >
                          <Sparkles size={11} /> Humanize
                        </button>
                        <div className="flex-1" />
                        {output.status !== "approved" && (
                          <button
                            onClick={() => handleApprove(output.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-accent hover:text-accent/80 transition-colors"
                          >
                            <CheckCircle2 size={11} /> Approve
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Empty / Analyzing / Generating State */
            <div className="flex-1 flex items-center justify-center">
              {analyzing ? (
                <div className="text-center">
                  <Loader2 size={32} className="animate-spin text-accent mx-auto mb-3" />
                  <p className="text-sm text-text-secondary mb-1">Analyzing transcript...</p>
                  <p className="text-[11px] text-text-muted">Extracting moments, clips, themes, and quotes.</p>
                </div>
              ) : generating ? (
                <div className="text-center">
                  <Loader2 size={32} className="animate-spin text-accent mx-auto mb-3" />
                  <p className="text-sm text-text-secondary mb-1">Generating content...</p>
                  <p className="text-[11px] text-text-muted">Writing platform-specific content for each host.</p>
                </div>
              ) : (
                <div className="text-center text-text-muted">
                  <RefreshCw size={32} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm mb-1">
                    {transcript?.status === "processed" && !masterAnalysis
                      ? "Ready to analyze."
                      : masterAnalysis && outputs.length === 0
                        ? "Analysis complete. Ready to generate content."
                        : "Waiting for data..."}
                  </p>
                  <p className="text-[11px]">Use the controls on the left to proceed.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
