"use client";

import { useState, useEffect, useCallback } from "react";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import { useToast } from "@/components/ui/toast";
import { ClipSelector } from "./components/clip-selector";
import { MusicConfig } from "./components/music-config";
import { VariantGrid } from "./components/variant-grid";

interface Clip {
  id: string;
  title: string;
  host_id: string | null;
  start_time: number;
  end_time: number;
  status: string;
}

interface MashupOutput {
  id: string;
  variant: string;
  status: string;
  output_url: string | null;
}

const PROCESSING_STATUSES = ["pending", "processing", "running"];

export default function MashupPage() {
  const { currentShow, currentEpisode } = useEpisodeStore();
  const { toast } = useToast();

  // Data state
  const [clips, setClips] = useState<Clip[]>([]);
  const [outputs, setOutputs] = useState<MashupOutput[]>([]);
  const [loadingClips, setLoadingClips] = useState(false);

  // UI state
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [musicUrl, setMusicUrl] = useState("");
  const [transitionStyle, setTransitionStyle] = useState("cut");
  const [generating, setGenerating] = useState(false);

  // Derived
  const hasProcessing = outputs.some((o) => PROCESSING_STATUSES.includes(o.status));

  // --- Data Fetching ---

  const fetchClips = useCallback(async () => {
    if (!currentEpisode) return;
    setLoadingClips(true);
    try {
      const res = await fetch(`/api/video-pipeline?episode_id=${currentEpisode.id}`);
      const json = await res.json();
      if (json.clips) setClips(json.clips);
    } finally {
      setLoadingClips(false);
    }
  }, [currentEpisode]);

  const fetchOutputs = useCallback(async () => {
    if (!currentEpisode) return;
    const res = await fetch(`/api/mashup?episode_id=${currentEpisode.id}`);
    const json = await res.json();
    if (json.outputs) setOutputs(json.outputs);
  }, [currentEpisode]);

  useEffect(() => {
    fetchClips();
    fetchOutputs();
  }, [fetchClips, fetchOutputs]);

  // Poll while outputs are processing
  useEffect(() => {
    if (!hasProcessing || !currentEpisode) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/mashup?episode_id=${currentEpisode.id}`);
      const json = await res.json();
      if (json.outputs) {
        setOutputs(json.outputs);
        const stillProcessing = json.outputs.some((o: MashupOutput) =>
          PROCESSING_STATUSES.includes(o.status)
        );
        if (!stillProcessing) {
          setGenerating(false);
          toast({ type: "success", message: "All 5 mashup variants ready!" });
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [hasProcessing, currentEpisode, toast]);

  // --- Actions ---

  function handleToggleClip(id: string) {
    setSelectedClipIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleSelectAll() {
    const allIds = clips
      .filter((c) => c.status === "done" || c.status === "queued" || c.status === "completed")
      .map((c) => c.id);
    setSelectedClipIds(allIds);
  }

  function handleClearAll() {
    setSelectedClipIds([]);
  }

  async function handleGenerate() {
    if (!currentShow || !currentEpisode || selectedClipIds.length === 0) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/mashup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episodeId: currentEpisode.id,
          showId: currentShow.id,
          clipIds: selectedClipIds,
          musicUrl: musicUrl || undefined,
          transitionStyle,
        }),
      });
      const json = await res.json();
      if (json.outputs) {
        setOutputs(json.outputs);
        toast({ type: "info", message: "Generating 5 mashup variants..." });
      } else if (json.error) {
        setGenerating(false);
        toast({ type: "error", message: json.error });
      }
    } catch {
      setGenerating(false);
      toast({ type: "error", message: "Failed to start mashup generation" });
    }
  }

  function handleDownload(outputId: string) {
    const output = outputs.find((o) => o.id === outputId);
    if (output?.output_url) {
      window.open(output.output_url, "_blank");
    } else {
      toast({ type: "info", message: "No output file yet" });
    }
  }

  // --- Guard ---

  if (!currentEpisode) {
    return (
      <div className="text-center py-16 text-text-muted">
        <p className="text-sm">Select an episode from the top bar to create mashups.</p>
      </div>
    );
  }

  // --- Render ---

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-display text-5xl text-accent mb-1">MASHUP MAKER</h1>
        <p className="text-text-secondary text-sm">
          Create hot takes reel with 5 auto-generated variants.
        </p>
      </div>

      <div className="flex gap-4 h-[calc(100vh-220px)]">
        {/* Left Panel — Clip Selector (30%) */}
        <div className="w-[30%] bg-bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
          <ClipSelector
            clips={clips}
            selectedIds={selectedClipIds}
            onToggle={handleToggleClip}
            onSelectAll={handleSelectAll}
            onClearAll={handleClearAll}
            loading={loadingClips}
          />
        </div>

        {/* Centre Panel — Music Config (40%) */}
        <div className="w-[40%] bg-bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
          <MusicConfig
            musicUrl={musicUrl}
            onMusicUrlChange={setMusicUrl}
            transitionStyle={transitionStyle}
            onTransitionStyleChange={setTransitionStyle}
            selectedCount={selectedClipIds.length}
            onGenerate={handleGenerate}
            generating={generating}
          />
        </div>

        {/* Right Panel — Variant Grid (30%) */}
        <div className="w-[30%] bg-bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
          <VariantGrid outputs={outputs} onDownload={handleDownload} />
        </div>
      </div>
    </div>
  );
}
