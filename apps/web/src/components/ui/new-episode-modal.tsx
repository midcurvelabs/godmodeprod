"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useEpisodeStore } from "@/lib/stores/episode-store";

export function NewEpisodeModal({ onClose }: { onClose: () => void }) {
  const { currentShow, episodes, createEpisode } = useEpisodeStore();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [recordingDate, setRecordingDate] = useState("");
  const [saving, setSaving] = useState(false);

  const nextNumber = episodes.length > 0
    ? Math.max(...episodes.map((e) => e.episode_number)) + 1
    : 1;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentShow || !title.trim()) return;
    setSaving(true);
    const ep = await createEpisode({
      showId: currentShow.id,
      episodeNumber: nextNumber,
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      recordingDate: recordingDate || undefined,
    });
    setSaving(false);
    if (ep) onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-bg-surface border border-border rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-3xl text-accent">NEW EPISODE</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-secondary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
              Episode Number
            </label>
            <div className="font-display text-4xl text-accent">
              EP {String(nextNumber).padStart(2, "0")}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Episode title..."
              className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
              Subtitle (optional)
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Episode subtitle..."
              className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
              Recording Date
            </label>
            <input
              type="date"
              value={recordingDate}
              onChange={(e) => setRecordingDate(e.target.value)}
              className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={!title.trim() || saving}
            className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
          >
            {saving ? "Creating..." : "Create Episode"}
          </button>
        </form>
      </div>
    </div>
  );
}
