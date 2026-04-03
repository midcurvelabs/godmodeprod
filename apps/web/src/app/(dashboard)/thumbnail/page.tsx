"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import { useToast } from "@/components/ui/toast";
import { PhotoUploads } from "./components/photo-uploads";
import { TextFields } from "./components/text-fields";
import { LivePreview } from "./components/live-preview";
import { ControlsPanel } from "./components/controls-panel";
import { GenerateOutput } from "./components/generate-output";

// --- Types ---

interface HostInfo {
  id: string;
  name: string;
}

interface ThumbnailOutput {
  id: string;
  output_url: string | null;
  status: string;
}

const STEPS = ["Upload", "Customize", "Generate"] as const;

// --- Component ---

export default function ThumbnailPage() {
  const { currentShow, currentEpisode } = useEpisodeStore();
  const { toast } = useToast();

  // Wizard state
  const [step, setStep] = useState(0);

  // Data state
  const [hosts, setHosts] = useState<HostInfo[]>([]);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [subtitle, setSubtitle] = useState("");
  const [hostOrder, setHostOrder] = useState<string[]>([]);
  const [textSize, setTextSize] = useState<"small" | "medium" | "large">("medium");
  const [stripePosition, setStripePosition] = useState<"top" | "middle" | "bottom">("bottom");

  // Output state
  const [generating, setGenerating] = useState(false);
  const [output, setOutput] = useState<ThumbnailOutput | null>(null);

  const episodeNumber = currentEpisode?.episode_number || 1;
  const hasPhotos = Object.values(photos).some((url) => url.length > 0);
  const canProceedStep1 = hasPhotos && subtitle.trim().length > 0;
  const canGenerate = canProceedStep1;

  // --- Data Fetching ---

  const fetchHosts = useCallback(async () => {
    if (!currentShow) return;
    const res = await fetch(`/api/hosts?show_id=${currentShow.id}`);
    const json = await res.json();
    if (json.hosts) {
      const mapped = json.hosts.map((h: { id: string; name: string }) => ({ id: h.id, name: h.name }));
      setHosts(mapped);
      setHostOrder(mapped.map((h: HostInfo) => h.id));
    }
  }, [currentShow]);

  const fetchExisting = useCallback(async () => {
    if (!currentEpisode) return;
    const res = await fetch(`/api/thumbnails?episode_id=${currentEpisode.id}`);
    const json = await res.json();
    if (json.thumbnails?.length > 0) {
      setOutput(json.thumbnails[0]);
    }
  }, [currentEpisode]);

  useEffect(() => {
    fetchHosts();
    fetchExisting();
  }, [fetchHosts, fetchExisting]);

  // Poll while generating
  useEffect(() => {
    if (!generating || !currentEpisode) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/thumbnails?episode_id=${currentEpisode.id}`);
      const json = await res.json();
      const latest = json.thumbnails?.[0];
      if (latest?.status === "done") {
        setOutput(latest);
        setGenerating(false);
        toast({ type: "success", message: "Thumbnail generated!" });
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [generating, currentEpisode, toast]);

  // --- Actions ---

  async function handleGenerate() {
    if (!currentShow || !currentEpisode) return;
    setGenerating(true);
    const res = await fetch("/api/thumbnails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        episodeId: currentEpisode.id,
        showId: currentShow.id,
        subtitle,
        episodeNumber,
        photos: Object.entries(photos)
          .filter(([, url]) => url)
          .map(([hostId, photoUrl]) => ({ hostId, photoUrl })),
      }),
    });
    const json = await res.json();
    if (json.thumbnail) {
      setOutput(json.thumbnail);
      toast({ type: "info", message: "Generating thumbnail..." });
    } else if (json.error) {
      setGenerating(false);
      toast({ type: "error", message: json.error });
    }
  }

  function handleDownload() {
    if (output?.output_url) {
      window.open(output.output_url, "_blank");
    }
  }

  function handleSendTelegram() {
    toast({ type: "info", message: "Telegram delivery coming in Sprint 4" });
  }

  // --- Guard ---

  if (!currentEpisode) {
    return (
      <div className="text-center py-16 text-text-muted">
        <p className="text-sm">Select an episode from the top bar to generate thumbnails.</p>
      </div>
    );
  }

  // --- Render ---

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-5xl text-accent mb-1">THUMBNAIL GENERATOR</h1>
        <p className="text-text-secondary text-sm">
          Produce branded episode thumbnail from host photos.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            {i > 0 && <div className="w-8 h-px bg-border" />}
            <button
              onClick={() => setStep(i)}
              disabled={i === 1 && !canProceedStep1}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                i === step
                  ? "bg-accent text-white"
                  : i < step
                  ? "bg-accent/15 text-accent"
                  : "bg-bg-elevated text-text-muted"
              } disabled:opacity-50`}
            >
              <span className="w-4 h-4 rounded-full bg-current/20 text-[10px] flex items-center justify-center font-bold">
                {i + 1}
              </span>
              {label}
            </button>
          </div>
        ))}
      </div>

      <div className="bg-bg-surface border border-border rounded-lg p-6">
        {/* Step 1: Upload */}
        {step === 0 && (
          <div className="space-y-6">
            <PhotoUploads
              hosts={hosts}
              photos={photos}
              onPhotoChange={(hostId, url) => setPhotos((prev) => ({ ...prev, [hostId]: url }))}
            />
            <TextFields
              episodeNumber={episodeNumber}
              subtitle={subtitle}
              onSubtitleChange={setSubtitle}
            />
            <div className="flex justify-end">
              <button
                onClick={() => setStep(1)}
                disabled={!canProceedStep1}
                className="flex items-center gap-1.5 px-4 py-2 rounded bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Customize */}
        {step === 1 && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2">
              <LivePreview
                photos={photos}
                hosts={hosts}
                hostOrder={hostOrder}
                episodeNumber={episodeNumber}
                subtitle={subtitle}
                textSize={textSize}
                stripePosition={stripePosition}
              />
            </div>
            <div>
              <ControlsPanel
                hosts={hosts}
                hostOrder={hostOrder}
                textSize={textSize}
                stripePosition={stripePosition}
                onHostOrderChange={setHostOrder}
                onTextSizeChange={setTextSize}
                onStripePositionChange={setStripePosition}
              />
            </div>
            <div className="col-span-3 flex justify-between">
              <button
                onClick={() => setStep(0)}
                className="flex items-center gap-1.5 px-4 py-2 rounded bg-bg-elevated border border-border text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                <ChevronLeft size={16} /> Back
              </button>
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-1.5 px-4 py-2 rounded bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Generate */}
        {step === 2 && (
          <div className="max-w-md mx-auto space-y-6">
            <GenerateOutput
              generating={generating}
              output={output}
              onGenerate={handleGenerate}
              onDownload={handleDownload}
              onSendTelegram={handleSendTelegram}
              canGenerate={canGenerate}
            />
            <div className="flex justify-start">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 px-4 py-2 rounded bg-bg-elevated border border-border text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                <ChevronLeft size={16} /> Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
