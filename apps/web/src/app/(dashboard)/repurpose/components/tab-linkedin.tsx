"use client";

import { useState } from "react";
import { CopyButton } from "./copy-button";
import { Sparkles, PenLine, Check } from "lucide-react";

const SPEAKER_COLORS = ["text-accent", "text-emerald-400", "text-blue-400", "text-amber-400", "text-purple-400"];

const ANGLE_STYLES: Record<string, string> = {
  builder: "bg-emerald-500/15 text-emerald-400",
  product: "bg-blue-500/15 text-blue-400",
  tech: "bg-purple-500/15 text-purple-400",
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

interface TabLinkedInProps {
  outputs: RepurposeOutput[];
  hosts: HostInfo[];
  selectedHost: string | null;
  onHumanize: (outputId: string) => void;
  onRegenerate: (outputType: string) => void;
  onSaveEdit: (outputId: string, content: Record<string, unknown>) => void;
}

export function TabLinkedIn({ outputs, hosts, selectedHost, onHumanize, onRegenerate, onSaveEdit }: TabLinkedInProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const linkedinOutputs = outputs.filter((o) => o.output_type === "linkedin");

  const filteredOutputs = selectedHost
    ? linkedinOutputs.filter((o) => {
        const host = hosts.find((h) => h.id === o.host_id);
        return host?.name === selectedHost;
      })
    : linkedinOutputs;

  if (filteredOutputs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted">
        <p className="text-sm">No LinkedIn posts generated yet.</p>
      </div>
    );
  }

  function startEdit(output: RepurposeOutput) {
    setEditingId(output.id);
    setEditText((output.content.post as string) || JSON.stringify(output.content, null, 2));
  }

  function saveEdit(outputId: string) {
    onSaveEdit(outputId, { ...filteredOutputs.find((o) => o.id === outputId)!.content, post: editText });
    setEditingId(null);
    setEditText("");
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-3 border-b border-border flex items-center gap-2">
        <span className="text-xs text-text-muted">{linkedinOutputs.length} post(s) &middot; Prose format, 300-400 words</span>
        <div className="flex-1" />
        <button
          onClick={() => onRegenerate("linkedin")}
          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-text-muted hover:text-accent transition-colors"
        >
          <Sparkles size={11} /> Regenerate All
        </button>
      </div>

      <div className="p-6 space-y-6">
        {filteredOutputs.map((output) => {
          const host = hosts.find((h) => h.id === output.host_id);
          const hostName = host?.name || "Unknown";
          const hostIndex = hosts.findIndex((h) => h.id === output.host_id);
          const post = (output.content.post as string) || "";
          const angle = (output.content.angle as string) || "";
          const charCount = (output.content.char_count as number) || post.length;
          const isEditing = editingId === output.id;

          return (
            <div key={output.id} className="border border-border rounded-lg overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-border flex items-center gap-2">
                <span className={`text-sm font-semibold ${SPEAKER_COLORS[hostIndex % SPEAKER_COLORS.length]}`}>
                  {hostName}
                </span>
                {angle && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ANGLE_STYLES[angle] || "bg-bg-elevated text-text-muted"}`}>
                    {angle}
                  </span>
                )}
                <div className="flex-1" />
                <span className={`text-[10px] ${charCount > 3000 ? "text-accent" : "text-text-muted"}`}>
                  {charCount.toLocaleString()}/3,000
                </span>
              </div>

              {/* Content */}
              <div className="p-4">
                {isEditing ? (
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full min-h-[300px] bg-bg-elevated border border-border rounded-lg px-4 py-3 text-sm text-text-primary leading-relaxed resize-none focus:outline-none focus:border-accent transition-colors"
                  />
                ) : (
                  <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                    {post}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-3 border-t border-border flex items-center gap-1">
                <CopyButton text={post} label="Copy" size="sm" />
                {isEditing ? (
                  <>
                    <button
                      onClick={() => saveEdit(output.id)}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-success hover:text-success/80 transition-colors"
                    >
                      <Check size={11} /> Save
                    </button>
                    <button
                      onClick={() => { setEditingId(null); setEditText(""); }}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-text-muted hover:text-text-secondary transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => startEdit(output)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-text-muted hover:text-text-secondary transition-colors"
                  >
                    <PenLine size={11} /> Edit
                  </button>
                )}
                <button
                  onClick={() => onHumanize(output.id)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-text-muted hover:text-text-secondary transition-colors"
                >
                  <Sparkles size={11} /> Humanize
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
