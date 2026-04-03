"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  Upload,
  Zap,
  Sparkles,
  FileText,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import { PipelineRail, type PipelineStep } from "./components/pipeline-rail";
import { UploadZone } from "./components/upload-zone";
import { ProgressView } from "./components/progress-view";
import { OutputTabs, type TabKey } from "./components/output-tabs";
import { TabOverview } from "./components/tab-overview";
import { TabShorts } from "./components/tab-shorts";
import { TabTwitter } from "./components/tab-twitter";
import { TabLinkedIn } from "./components/tab-linkedin";
import { TabYouTube } from "./components/tab-youtube";
import { TabSchedule } from "./components/tab-schedule";

// --- Types ---

interface TranscriptData {
  id: string;
  episode_id: string;
  raw_content: string;
  clean_content: string | null;
  speaker_tags: Record<string, { line_count: number; word_count: number }> | null;
  word_count: number;
  status: string;
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

interface HostInfo {
  id: string;
  name: string;
}

const SPEAKER_COLORS = [
  "text-accent",
  "text-emerald-400",
  "text-blue-400",
  "text-amber-400",
  "text-purple-400",
];

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

  // Data state
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [masterAnalysis, setMasterAnalysis] = useState<RepurposeOutput | null>(null);
  const [outputs, setOutputs] = useState<RepurposeOutput[]>([]);
  const [hosts, setHosts] = useState<HostInfo[]>([]);

  // Process state
  const [uploading, setUploading] = useState(false);
  const [transcriptProcessing, setTranscriptProcessing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [selectedHost, setSelectedHost] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Derived
  const currentStep = getPipelineStep(transcript, !!masterAnalysis, outputs.length > 0);
  const hostNames = hosts.map((h) => h.name);
  const approvedCount = outputs.filter((o) => o.status === "approved").length;
  const speakerNames = transcript?.speaker_tags ? Object.keys(transcript.speaker_tags) : [];
  const showOutputTabs = outputs.length > 0 && !analyzing && !generating;

  const progressState: "empty" | "processing" | "analyzing" | "generating" | "ready" =
    !transcript ? "empty" :
    transcriptProcessing ? "processing" :
    analyzing ? "analyzing" :
    generating ? "generating" :
    "ready";

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
    if (json.master) setMasterAnalysis(json.master);
    if (json.outputs?.length > 0) setOutputs(json.outputs);
  }, [currentEpisode]);

  const fetchHosts = useCallback(async () => {
    if (!currentShow) return;
    const res = await fetch(`/api/hosts?show_id=${currentShow.id}`);
    const json = await res.json();
    if (json.hosts) setHosts(json.hosts.map((h: { id: string; name: string }) => ({ id: h.id, name: h.name })));
  }, [currentShow]);

  useEffect(() => {
    fetchTranscript();
    fetchRepurposeData();
    fetchHosts();
  }, [fetchTranscript, fetchRepurposeData, fetchHosts]);

  // Poll: transcript processing
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

  // Poll: analysis
  useEffect(() => {
    if (!analyzing || !currentEpisode) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/repurpose?episode_id=${currentEpisode.id}`);
      const json = await res.json();
      if (json.master) {
        setMasterAnalysis(json.master);
        setAnalyzing(false);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [analyzing, currentEpisode]);

  // Poll: content generation
  useEffect(() => {
    if (!generating || !currentEpisode) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/repurpose?episode_id=${currentEpisode.id}`);
      const json = await res.json();
      if (json.outputs?.length > 0) {
        setOutputs(json.outputs);
        setGenerating(false);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [generating, currentEpisode]);

  // --- Actions ---

  async function handleUpload(rawContent: string) {
    if (!currentShow || !currentEpisode) return;
    setUploading(true);
    const res = await fetch("/api/transcripts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ episodeId: currentEpisode.id, showId: currentShow.id, rawContent }),
    });
    const json = await res.json();
    if (json.transcript) {
      setTranscript(json.transcript);
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
      body: JSON.stringify({ action: "analyze", episodeId: currentEpisode.id, showId: currentShow.id }),
    });
  }

  async function handleGenerateContent() {
    if (!currentShow || !currentEpisode) return;
    setGenerating(true);
    await fetch("/api/repurpose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "write", episodeId: currentEpisode.id, showId: currentShow.id }),
    });
  }

  async function handleHumanize(outputId: string) {
    if (!currentShow || !currentEpisode) return;
    await fetch("/api/repurpose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "humanize", episodeId: currentEpisode.id, showId: currentShow.id, outputId }),
    });
  }

  async function handleRegenerate(outputType: string) {
    if (!currentShow || !currentEpisode) return;
    setGenerating(true);
    await fetch("/api/repurpose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "regenerate", episodeId: currentEpisode.id, showId: currentShow.id, outputType }),
    });
  }

  async function handleSaveEdit(outputId: string, content: Record<string, unknown>) {
    await fetch(`/api/repurpose/${outputId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setOutputs((prev) => prev.map((o) => (o.id === outputId ? { ...o, content } : o)));
  }

  async function handleApprove(outputId: string) {
    await fetch(`/api/repurpose/${outputId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    setOutputs((prev) => prev.map((o) => (o.id === outputId ? { ...o, status: "approved" } : o)));
  }

  // --- Guards ---

  if (!currentEpisode) {
    return (
      <div className="text-center py-16 text-text-muted">
        <p className="text-sm">Select an episode from the top bar to start repurposing.</p>
      </div>
    );
  }

  // --- Render ---

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-5xl text-accent mb-1">REPURPOSE ENGINE</h1>
        <p className="text-text-secondary text-sm">
          Transform transcript into content for every platform.
        </p>
      </div>

      <PipelineRail currentStep={currentStep} />

      <div className="flex gap-4 h-[calc(100vh-280px)] mt-6">
        {/* Left Panel (35%) */}
        <div className="w-[35%] bg-bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
          {!transcript ? (
            <UploadZone onUpload={handleUpload} uploading={uploading} />
          ) : (
            <div className="flex flex-col h-full overflow-y-auto">
              {/* Transcript status */}
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

              {/* Speaker stats */}
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

              {/* Word count + copy */}
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

              {/* Action buttons */}
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
                {outputs.length > 0 && (
                  <div className="text-xs text-text-muted text-center">
                    {approvedCount}/{outputs.length} outputs approved
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel (65%) */}
        <div className="w-[65%] bg-bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
          {showOutputTabs ? (
            <>
              <OutputTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                hosts={hostNames}
                selectedHost={selectedHost}
                onHostChange={setSelectedHost}
                approvedCount={approvedCount}
                totalCount={outputs.length}
              />
              <div className="flex-1 overflow-y-auto">
                {activeTab === "overview" && masterAnalysis && (
                  <TabOverview analysis={masterAnalysis.content as Record<string, unknown>} hostNames={hostNames} />
                )}
                {activeTab === "shorts" && (
                  <TabShorts outputs={outputs} hosts={hosts} selectedHost={selectedHost} onHumanize={handleHumanize} onRegenerate={handleRegenerate} />
                )}
                {activeTab === "twitter" && (
                  <TabTwitter outputs={outputs} hosts={hosts} selectedHost={selectedHost} onHumanize={handleHumanize} onRegenerate={handleRegenerate} />
                )}
                {activeTab === "linkedin" && (
                  <TabLinkedIn outputs={outputs} hosts={hosts} selectedHost={selectedHost} onHumanize={handleHumanize} onRegenerate={handleRegenerate} onSaveEdit={handleSaveEdit} />
                )}
                {activeTab === "youtube" && (
                  <TabYouTube outputs={outputs} onRegenerate={handleRegenerate} />
                )}
                {activeTab === "schedule" && (
                  <TabSchedule outputs={outputs} onRegenerate={handleRegenerate} />
                )}
              </div>
            </>
          ) : (
            <ProgressView
              state={progressState}
              transcriptStatus={transcript?.status}
              hasMaster={!!masterAnalysis}
              hasOutputs={outputs.length > 0}
            />
          )}
        </div>
      </div>
    </div>
  );
}
