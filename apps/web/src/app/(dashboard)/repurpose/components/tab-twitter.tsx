"use client";

import { useState } from "react";
import { CopyButton } from "./copy-button";
import { Sparkles, Hash } from "lucide-react";

const SPEAKER_COLORS = ["text-accent", "text-emerald-400", "text-blue-400", "text-amber-400", "text-purple-400"];

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

interface TabTwitterProps {
  outputs: RepurposeOutput[];
  hosts: HostInfo[];
  selectedHost: string | null;
  onHumanize: (outputId: string) => void;
  onRegenerate: (outputType: string) => void;
}

export function TabTwitter({ outputs, hosts, selectedHost, onHumanize, onRegenerate }: TabTwitterProps) {
  const [activeHostTab, setActiveHostTab] = useState<string | null>(null);

  const twitterOutputs = outputs.filter((o) => o.output_type === "twitter");

  const filteredOutputs = selectedHost
    ? twitterOutputs.filter((o) => {
        const host = hosts.find((h) => h.id === o.host_id);
        return host?.name === selectedHost;
      })
    : twitterOutputs;

  // Auto-select first host if none selected
  const displayHost = activeHostTab
    ? filteredOutputs.find((o) => hosts.find((h) => h.id === o.host_id)?.name === activeHostTab)
    : filteredOutputs[0];

  if (filteredOutputs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted">
        <p className="text-sm">No Twitter content generated yet.</p>
      </div>
    );
  }

  const currentHost = displayHost ? hosts.find((h) => h.id === displayHost.host_id) : null;
  const thread = (displayHost?.content.thread || []) as string[];
  const standalones = (displayHost?.content.standalone_tweets || []) as Array<Record<string, unknown> | string>;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Toolbar */}
      <div className="sticky top-0 p-3 border-b border-border bg-bg-surface flex items-center gap-2">
        {/* Host sub-tabs */}
        <div className="flex gap-1">
          {filteredOutputs.map((output) => {
            const host = hosts.find((h) => h.id === output.host_id);
            const hostIndex = hosts.findIndex((h) => h.id === output.host_id);
            const isActive = displayHost?.id === output.id;
            return (
              <button
                key={output.id}
                onClick={() => setActiveHostTab(host?.name || null)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? `${SPEAKER_COLORS[hostIndex % SPEAKER_COLORS.length]} bg-bg-elevated`
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {host?.name || "Unknown"}
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        {displayHost && (
          <button
            onClick={() => onHumanize(displayHost.id)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-text-muted hover:text-text-secondary transition-colors"
          >
            <Sparkles size={11} /> Humanize
          </button>
        )}
        <button
          onClick={() => onRegenerate("twitter")}
          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-text-muted hover:text-accent transition-colors"
        >
          <Sparkles size={11} /> Regenerate
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Thread */}
        {thread.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
                Thread ({thread.length} tweets)
              </h4>
              <CopyButton text={thread.join("\n\n")} label="Copy Thread" size="sm" />
            </div>
            <div className="space-y-0">
              {thread.map((tweet, i) => (
                <div key={i} className="flex gap-3 group">
                  {/* Thread line */}
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-[10px] text-text-muted font-medium shrink-0">
                      {i + 1}
                    </div>
                    {i < thread.length - 1 && <div className="w-px flex-1 bg-border" />}
                  </div>
                  {/* Tweet content */}
                  <div className="pb-4 flex-1">
                    <p className="text-sm text-text-primary leading-relaxed">{tweet}</p>
                    <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <CopyButton text={tweet} label="" size="sm" />
                      <span className="text-[10px] text-text-muted">{tweet.length}/280</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Standalone Tweets */}
        {standalones.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
                Standalone Tweets ({standalones.length})
              </h4>
              <CopyButton
                text={standalones.map((t) => (typeof t === "string" ? t : (t.text as string))).join("\n\n---\n\n")}
                label="Copy All"
                size="sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {standalones.map((tweet, i) => {
                const text = typeof tweet === "string" ? tweet : (tweet.text as string);
                const type = typeof tweet === "object" ? (tweet.type as string) : undefined;
                const clipRef = typeof tweet === "object" ? (tweet.clip_ref as string) : undefined;
                return (
                  <div key={i} className="border border-border rounded-lg p-3 group">
                    <div className="flex items-start gap-2">
                      <Hash size={14} className="text-blue-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-text-primary leading-relaxed">{text}</p>
                        <div className="flex items-center gap-2 mt-2">
                          {type && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              type === "clip_paired" ? "bg-purple-500/15 text-purple-400" : "bg-bg-elevated text-text-muted"
                            }`}>
                              {type === "clip_paired" ? "Clip" : "Text"}
                            </span>
                          )}
                          {clipRef && <span className="text-[10px] text-text-muted">{clipRef}</span>}
                          <div className="flex-1" />
                          <span className="text-[10px] text-text-muted">{text.length}/280</span>
                          <CopyButton text={text} label="" size="sm" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
