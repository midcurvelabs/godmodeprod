"use client";

import { CopyButton } from "./copy-button";
import { Sparkles } from "lucide-react";

const SPEAKER_COLORS = ["text-accent", "text-emerald-400", "text-blue-400", "text-amber-400", "text-purple-400"];

const PLATFORM_STYLES: Record<string, string> = {
  tiktok: "bg-pink-500/15 text-pink-400",
  instagram: "bg-purple-500/15 text-purple-400",
  youtube_shorts: "bg-red-500/15 text-red-400",
};

interface RepurposeOutput {
  id: string;
  output_type: string;
  content: Record<string, unknown>;
  host_id: string | null;
  status: string;
}

interface HostInfo {
  id: string;
  name: string;
}

interface TabShortsProps {
  outputs: RepurposeOutput[];
  hosts: HostInfo[];
  selectedHost: string | null;
  onHumanize: (outputId: string) => void;
  onRegenerate: (outputType: string) => void;
}

export function TabShorts({ outputs, hosts, selectedHost, onHumanize, onRegenerate }: TabShortsProps) {
  const captionOutputs = outputs.filter((o) => o.output_type === "captions");

  // Filter by selected host
  const filteredOutputs = selectedHost
    ? captionOutputs.filter((o) => {
        const host = hosts.find((h) => h.id === o.host_id);
        return host?.name === selectedHost;
      })
    : captionOutputs;

  if (filteredOutputs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted">
        <p className="text-sm">No shorts captions generated yet.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-3 border-b border-border flex items-center gap-2">
        <span className="text-xs text-text-muted">
          {captionOutputs.length} host(s) &middot; Captions for TikTok, Instagram Reels, YouTube Shorts
        </span>
        <div className="flex-1" />
        <button
          onClick={() => onRegenerate("captions")}
          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-text-muted hover:text-accent transition-colors"
        >
          <Sparkles size={11} /> Regenerate All
        </button>
      </div>

      <div className="p-4">
        {/* Grid: one column per host */}
        <div className={`grid gap-4 ${filteredOutputs.length === 1 ? "grid-cols-1" : filteredOutputs.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {filteredOutputs.map((output) => {
            const host = hosts.find((h) => h.id === output.host_id);
            const hostName = host?.name || "Unknown";
            const hostIndex = hosts.findIndex((h) => h.id === output.host_id);
            const clips = (output.content.clips || []) as Array<Record<string, unknown>>;

            return (
              <div key={output.id} className="space-y-3">
                {/* Host Header */}
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-semibold ${SPEAKER_COLORS[hostIndex % SPEAKER_COLORS.length]}`}>
                    {hostName}
                  </span>
                  <span className="text-[10px] text-text-muted">{clips.length} clips</span>
                </div>

                {/* Clip Cards */}
                {clips.map((clip, i) => (
                  <div key={i} className="border border-border rounded-lg p-3 bg-bg-elevated">
                    {/* Hook */}
                    <p className="text-sm font-semibold text-text-primary mb-1">
                      {(clip.hook || clip.clip_ref) as string}
                    </p>

                    {/* Platform Captions */}
                    {["tiktok", "instagram", "youtube_shorts"].map((platform) => {
                      const caption = clip[platform] as string;
                      if (!caption) return null;
                      return (
                        <div key={platform} className="mt-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${PLATFORM_STYLES[platform]}`}>
                              {platform.replace("_", " ")}
                            </span>
                          </div>
                          <p className="text-[12px] text-text-secondary leading-relaxed line-clamp-3">{caption}</p>
                          <CopyButton text={caption} size="sm" className="mt-1" />
                        </div>
                      );
                    })}

                    {/* Tagged Companies */}
                    {(clip.companies_tagged as string[])?.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {(clip.companies_tagged as string[]).map((tag) => (
                          <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Humanize Button */}
                <button
                  onClick={() => onHumanize(output.id)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-text-muted hover:text-text-secondary hover:border-text-muted transition-colors"
                >
                  <Sparkles size={12} /> Humanize {hostName}&apos;s Captions
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
