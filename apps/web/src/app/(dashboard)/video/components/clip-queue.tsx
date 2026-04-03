"use client";

import { useState } from "react";
import { Download, Plus, Play, X } from "lucide-react";
import { ClipItem } from "./clip-item";

interface Clip {
  id: string;
  title: string;
  host_id: string | null;
  start_time: number;
  end_time: number;
  status: string;
}

interface Host {
  id: string;
  name: string;
}

interface ClipQueueProps {
  clips: Clip[];
  hosts: Host[];
  selectedClipId: string | null;
  onSelect: (id: string) => void;
  onImportFromAnalysis: () => void;
  onAddClip: (data: { name: string; hostId: string; startTime: number; endTime: number; hook: string }) => void;
  onProcessAll: () => void;
  hasAnalysis: boolean;
  processing: boolean;
}

function parseTimeInput(value: string): number {
  const parts = value.split(":").map(Number);
  if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
  return Number(value) || 0;
}

export function ClipQueue({
  clips,
  hosts,
  selectedClipId,
  onSelect,
  onImportFromAnalysis,
  onAddClip,
  onProcessAll,
  hasAnalysis,
  processing,
}: ClipQueueProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [hostId, setHostId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [hook, setHook] = useState("");

  const queuedCount = clips.filter((c) => c.status === "queued").length;
  const hostMap = Object.fromEntries(hosts.map((h) => [h.id, h.name]));

  function handleSubmit() {
    if (!name.trim() || !startTime || !endTime) return;
    onAddClip({
      name: name.trim(),
      hostId,
      startTime: parseTimeInput(startTime),
      endTime: parseTimeInput(endTime),
      hook: hook.trim(),
    });
    setName("");
    setHostId("");
    setStartTime("");
    setEndTime("");
    setHook("");
    setShowForm(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
            Clip Queue
          </h3>
          <span className="text-[11px] text-text-muted">{clips.length} clips</span>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-1.5">
          {hasAnalysis && (
            <button
              onClick={onImportFromAnalysis}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-bg-elevated border border-border text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              <Download size={12} /> Import from Analysis
            </button>
          )}
          <div className="flex gap-1.5">
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-bg-elevated border border-border text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              {showForm ? <X size={12} /> : <Plus size={12} />}
              {showForm ? "Cancel" : "Add Manual"}
            </button>
            {queuedCount > 0 && (
              <button
                onClick={onProcessAll}
                disabled={processing}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-colors disabled:opacity-50"
              >
                <Play size={12} /> Process All ({queuedCount})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Inline Add Form */}
      {showForm && (
        <div className="p-3 border-b border-border space-y-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Clip name..."
            className="w-full bg-bg-elevated border border-border rounded px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50"
          />
          <select
            value={hostId}
            onChange={(e) => setHostId(e.target.value)}
            className="w-full bg-bg-elevated border border-border rounded px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50"
          >
            <option value="">Select host...</option>
            {hosts.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              type="text"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              placeholder="Start (mm:ss)"
              className="flex-1 bg-bg-elevated border border-border rounded px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50"
            />
            <input
              type="text"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              placeholder="End (mm:ss)"
              className="flex-1 bg-bg-elevated border border-border rounded px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50"
            />
          </div>
          <input
            type="text"
            value={hook}
            onChange={(e) => setHook(e.target.value)}
            placeholder="Hook / caption text (optional)"
            className="w-full bg-bg-elevated border border-border rounded px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50"
          />
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !startTime || !endTime}
            className="w-full px-2 py-1.5 rounded bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-colors disabled:opacity-50"
          >
            Add Clip
          </button>
        </div>
      )}

      {/* Clip List */}
      <div className="flex-1 overflow-y-auto">
        {clips.length === 0 ? (
          <div className="p-6 text-center text-text-muted text-xs">
            {hasAnalysis
              ? "Import clips from analysis or add manually."
              : "No clips yet. Add clips manually or run repurpose analysis first."}
          </div>
        ) : (
          clips.map((clip) => (
            <ClipItem
              key={clip.id}
              clip={clip}
              hostName={hostMap[clip.host_id || ""] || ""}
              selected={selectedClipId === clip.id}
              onSelect={() => onSelect(clip.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
