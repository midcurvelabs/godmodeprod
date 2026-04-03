"use client";

import { useState, useEffect, useCallback } from "react";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import { useToast } from "@/components/ui/toast";
import { SourceUploadBar } from "./components/source-upload-bar";
import { ClipQueue } from "./components/clip-queue";
import { PreviewPanel } from "./components/preview-panel";
import { OutputPanel } from "./components/output-panel";

// --- Types ---

interface SourceVideo {
  id: string;
  file_url: string;
  duration_seconds: number | null;
  format: string;
}

interface Clip {
  id: string;
  title: string;
  host_id: string | null;
  start_time: number;
  end_time: number;
  status: string;
  caption_text: string | null;
  output_url: string | null;
  format: string;
}

interface HostInfo {
  id: string;
  name: string;
}

const PROCESSING_STATUSES = ["cutting", "transcribing", "captioning", "compositing"];

// --- Component ---

export default function VideoPage() {
  const { currentShow, currentEpisode } = useEpisodeStore();
  const { toast } = useToast();

  // Data state
  const [sourceVideo, setSourceVideo] = useState<SourceVideo | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [hosts, setHosts] = useState<HostInfo[]>([]);
  const [hasAnalysis, setHasAnalysis] = useState(false);

  // UI state
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [format, setFormat] = useState("9:16");
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Derived
  const selectedClip = clips.find((c) => c.id === selectedClipId) || null;
  const hasProcessingClips = clips.some((c) => PROCESSING_STATUSES.includes(c.status));

  // --- Data Fetching ---

  const fetchData = useCallback(async () => {
    if (!currentEpisode) return;
    const res = await fetch(`/api/video-pipeline?episode_id=${currentEpisode.id}`);
    const json = await res.json();
    if (json.sourceVideo) setSourceVideo(json.sourceVideo);
    if (json.clips) setClips(json.clips);
  }, [currentEpisode]);

  const fetchHosts = useCallback(async () => {
    if (!currentShow) return;
    const res = await fetch(`/api/hosts?show_id=${currentShow.id}`);
    const json = await res.json();
    if (json.hosts) setHosts(json.hosts.map((h: { id: string; name: string }) => ({ id: h.id, name: h.name })));
  }, [currentShow]);

  const checkAnalysis = useCallback(async () => {
    if (!currentEpisode) return;
    const res = await fetch(`/api/repurpose?episode_id=${currentEpisode.id}&output_type=clip_timestamps`);
    const json = await res.json();
    setHasAnalysis(!!(json.outputs?.length > 0 || json.master));
  }, [currentEpisode]);

  useEffect(() => {
    fetchData();
    fetchHosts();
    checkAnalysis();
  }, [fetchData, fetchHosts, checkAnalysis]);

  // Poll while clips are processing
  useEffect(() => {
    if (!hasProcessingClips || !currentEpisode) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/video-pipeline?episode_id=${currentEpisode.id}`);
      const json = await res.json();
      if (json.clips) {
        setClips(json.clips);
        const stillProcessing = json.clips.some((c: Clip) => PROCESSING_STATUSES.includes(c.status));
        if (!stillProcessing) {
          setProcessing(false);
          toast({ type: "success", message: "All clips processed!" });
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [hasProcessingClips, currentEpisode, toast]);

  // --- Actions ---

  async function handleUploadSource(url: string, duration?: number) {
    if (!currentEpisode) return;
    setUploading(true);
    try {
      const res = await fetch("/api/video-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upload-source", episodeId: currentEpisode.id, fileUrl: url, duration }),
      });
      const json = await res.json();
      if (json.sourceVideo) {
        setSourceVideo(json.sourceVideo);
        toast({ type: "success", message: "Source video linked" });
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleImportFromAnalysis() {
    if (!currentEpisode) return;
    const res = await fetch("/api/video-pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "import-from-analysis",
        episodeId: currentEpisode.id,
        sourceVideoId: sourceVideo?.id || null,
      }),
    });
    const json = await res.json();
    if (json.clips) {
      setClips((prev) => [...prev, ...json.clips]);
      toast({ type: "success", message: `Imported ${json.clips.length} clips` });
    } else if (json.error) {
      toast({ type: "error", message: json.error });
    }
  }

  async function handleAddClip(data: { name: string; hostId: string; startTime: number; endTime: number; hook: string }) {
    if (!currentEpisode) return;
    const res = await fetch("/api/video-pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add-clip",
        episodeId: currentEpisode.id,
        sourceVideoId: sourceVideo?.id || null,
        name: data.name,
        hostId: data.hostId || null,
        startTime: data.startTime,
        endTime: data.endTime,
        hook: data.hook,
      }),
    });
    const json = await res.json();
    if (json.clip) {
      setClips((prev) => [...prev, json.clip]);
      toast({ type: "success", message: "Clip added" });
    }
  }

  async function handleProcessAll() {
    if (!currentShow || !currentEpisode) return;
    setProcessing(true);
    const res = await fetch("/api/video-pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "process-all", episodeId: currentEpisode.id, showId: currentShow.id }),
    });
    const json = await res.json();
    if (json.jobs) {
      // Optimistic update: mark queued clips as cutting
      setClips((prev) => prev.map((c) => c.status === "queued" ? { ...c, status: "cutting" } : c));
      toast({ type: "info", message: `Processing ${json.jobs.length} clips...` });
    } else if (json.error) {
      setProcessing(false);
      toast({ type: "error", message: json.error });
    }
  }

  async function handleUpdateClip(clipId: string, updates: Record<string, unknown>) {
    const res = await fetch(`/api/video-pipeline/${clipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const json = await res.json();
    if (json.clip) {
      setClips((prev) => prev.map((c) => c.id === clipId ? json.clip : c));
    }
  }

  function handleCaptionChange(text: string) {
    if (!selectedClip) return;
    setClips((prev) => prev.map((c) => c.id === selectedClip.id ? { ...c, caption_text: text } : c));
  }

  function handleSaveCaption() {
    if (!selectedClip) return;
    handleUpdateClip(selectedClip.id, { captionText: selectedClip.caption_text });
    toast({ type: "success", message: "Caption saved" });
  }

  function handleDownload(clipId: string) {
    const clip = clips.find((c) => c.id === clipId);
    if (clip?.output_url) {
      window.open(clip.output_url, "_blank");
    } else {
      toast({ type: "info", message: "No output file yet — process the clip first" });
    }
  }

  function handleSendTelegram(clipId: string) {
    toast({ type: "info", message: "Telegram delivery coming in Sprint 4" });
  }

  // --- Guard ---

  if (!currentEpisode) {
    return (
      <div className="text-center py-16 text-text-muted">
        <p className="text-sm">Select an episode from the top bar to start the video pipeline.</p>
      </div>
    );
  }

  // --- Render ---

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-display text-5xl text-accent mb-1">VIDEO PIPELINE</h1>
        <p className="text-text-secondary text-sm">
          Cut clips, generate captions, render finished reels.
        </p>
      </div>

      <SourceUploadBar
        sourceVideo={sourceVideo}
        onUpload={handleUploadSource}
        uploading={uploading}
      />

      <div className="flex gap-4 h-[calc(100vh-280px)] mt-4">
        {/* Left Panel — Clip Queue (25%) */}
        <div className="w-[25%] bg-bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
          <ClipQueue
            clips={clips}
            hosts={hosts}
            selectedClipId={selectedClipId}
            onSelect={setSelectedClipId}
            onImportFromAnalysis={handleImportFromAnalysis}
            onAddClip={handleAddClip}
            onProcessAll={handleProcessAll}
            hasAnalysis={hasAnalysis}
            processing={processing}
          />
        </div>

        {/* Centre Panel — Preview & Trim (50%) */}
        <div className="w-[50%] bg-bg-surface border border-border rounded-lg overflow-hidden">
          <PreviewPanel
            clip={selectedClip}
            format={format}
            onFormatChange={setFormat}
            onCaptionChange={handleCaptionChange}
            onSaveCaption={handleSaveCaption}
          />
        </div>

        {/* Right Panel — Outputs (25%) */}
        <div className="w-[25%] bg-bg-surface border border-border rounded-lg overflow-hidden">
          <OutputPanel
            clips={clips}
            hosts={hosts}
            onDownload={handleDownload}
            onSendTelegram={handleSendTelegram}
          />
        </div>
      </div>
    </div>
  );
}
