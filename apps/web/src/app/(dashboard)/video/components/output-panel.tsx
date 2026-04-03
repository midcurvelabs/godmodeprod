"use client";

import { Film } from "lucide-react";
import { OutputCard } from "./output-card";

interface Clip {
  id: string;
  title: string;
  host_id: string | null;
  start_time: number;
  end_time: number;
  status: string;
  output_url: string | null;
  format: string;
}

interface Host {
  id: string;
  name: string;
}

interface OutputPanelProps {
  clips: Clip[];
  hosts: Host[];
  onDownload: (clipId: string) => void;
  onSendTelegram: (clipId: string) => void;
}

export function OutputPanel({ clips, hosts, onDownload, onSendTelegram }: OutputPanelProps) {
  const doneClips = clips.filter((c) => c.status === "done");
  const hostMap = Object.fromEntries(hosts.map((h) => [h.id, h.name]));

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
            Outputs
          </h3>
          <span className="text-[11px] text-text-muted">{doneClips.length} done</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {doneClips.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <Film size={24} className="mb-2 opacity-40" />
            <p className="text-xs text-center">Processed clips will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {doneClips.map((clip) => (
              <OutputCard
                key={clip.id}
                clip={clip}
                hostName={hostMap[clip.host_id || ""] || ""}
                onDownload={onDownload}
                onSendTelegram={onSendTelegram}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
