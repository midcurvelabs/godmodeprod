"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  Copy,
  CheckCircle2,
  PenLine,
  Sparkles,
  AlertCircle,
  Check,
  Mail,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useEpisodeStore } from "@/lib/stores/episode-store";

interface NewsletterData {
  id: string;
  episode_id: string;
  main_content: string;
  notes_content: string;
  subject_options: string[];
  status: string;
  generated_at: string;
}

type TabView = "main" | "notes";

export default function NewsletterPage() {
  const { currentShow, currentEpisode } = useEpisodeStore();

  const [newsletter, setNewsletter] = useState<NewsletterData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<TabView>("main");
  const [selectedSubject, setSelectedSubject] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editMain, setEditMain] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [hasTranscript, setHasTranscript] = useState(false);
  const [tone, setTone] = useState<"default" | "formal" | "shorter">("default");
  const [sections, setSections] = useState<string[]>(["intro", "topics", "quotes", "links", "closing"]);
  const [notesExpanded, setNotesExpanded] = useState(false);

  const fetchNewsletter = useCallback(async () => {
    if (!currentEpisode) return;
    const res = await fetch(`/api/newsletter?episode_id=${currentEpisode.id}`);
    const json = await res.json();
    if (json.newsletter) setNewsletter(json.newsletter);
  }, [currentEpisode]);

  const checkPrerequisites = useCallback(async () => {
    if (!currentEpisode) return;
    const res = await fetch(`/api/transcripts?episode_id=${currentEpisode.id}`);
    const json = await res.json();
    setHasTranscript(json.transcript?.status === "processed");
  }, [currentEpisode]);

  useEffect(() => {
    fetchNewsletter();
    checkPrerequisites();
  }, [fetchNewsletter, checkPrerequisites]);

  // Poll for generation completion
  useEffect(() => {
    if (!generating || !currentEpisode) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/newsletter?episode_id=${currentEpisode.id}`);
      const json = await res.json();
      if (json.newsletter) {
        setNewsletter(json.newsletter);
        setGenerating(false);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [generating, currentEpisode]);

  async function handleGenerate() {
    if (!currentShow || !currentEpisode) return;
    setGenerating(true);
    await fetch("/api/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        episodeId: currentEpisode.id,
        showId: currentShow.id,
        tone,
        sections,
      }),
    });
  }

  async function handleSave() {
    if (!newsletter) return;
    await fetch(`/api/newsletter/${newsletter.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        main_content: editMain,
        notes_content: editNotes,
      }),
    });
    setNewsletter({ ...newsletter, main_content: editMain, notes_content: editNotes });
    setEditing(false);
  }

  async function handleApprove() {
    if (!newsletter) return;
    await fetch(`/api/newsletter/${newsletter.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    setNewsletter({ ...newsletter, status: "approved" });
  }

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  function startEditing() {
    if (!newsletter) return;
    setEditMain(newsletter.main_content);
    setEditNotes(newsletter.notes_content);
    setEditing(true);
  }

  if (!currentEpisode) {
    return (
      <div className="text-center py-16 text-text-muted">
        <p className="text-sm">Select an episode from the top bar to generate a newsletter.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-5xl text-accent mb-1">NEWSLETTER</h1>
        <p className="text-text-secondary text-sm">
          Generate ready-to-paste Substack post from the episode.
        </p>
      </div>

      <div className="flex gap-4 h-[calc(100vh-220px)]">
        {/* Left Panel (40%) */}
        <div className="w-[40%] bg-bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
          {/* Prerequisites */}
          <div className="p-4 border-b border-border">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted mb-3">
              Prerequisites
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {hasTranscript ? (
                  <CheckCircle2 size={14} className="text-success" />
                ) : (
                  <AlertCircle size={14} className="text-warning" />
                )}
                <span className={`text-sm ${hasTranscript ? "text-text-secondary" : "text-warning"}`}>
                  Processed transcript
                </span>
              </div>
            </div>
          </div>

          {/* Tone Selector */}
          <div className="p-4 border-b border-border">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted mb-2">
              Tone
            </h3>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as "default" | "formal" | "shorter")}
              disabled={!!newsletter}
              className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="default">Default</option>
              <option value="formal">More formal</option>
              <option value="shorter">Shorter</option>
            </select>
          </div>

          {/* Section Checkboxes */}
          <div className="p-4 border-b border-border">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted mb-2">
              Sections
            </h3>
            <div className="space-y-1.5">
              {[
                { key: "intro", label: "Intro" },
                { key: "topics", label: "Topic sections" },
                { key: "quotes", label: "Pull quotes" },
                { key: "links", label: "Links" },
                { key: "closing", label: "Closing POV" },
              ].map(({ key, label }) => (
                <label key={key} className={`flex items-center gap-2 py-1 cursor-pointer ${newsletter ? "opacity-50 cursor-not-allowed" : ""}`}>
                  <input
                    type="checkbox"
                    checked={sections.includes(key)}
                    disabled={!!newsletter}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSections((prev) => [...prev, key]);
                      } else {
                        setSections((prev) => prev.filter((s) => s !== key));
                      }
                    }}
                    className="accent-accent"
                  />
                  <span className="text-sm text-text-secondary">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Subject Lines */}
          {newsletter && newsletter.subject_options.length > 0 && (
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
                  Subject Line
                </h3>
                <button
                  onClick={() => copyToClipboard(newsletter.subject_options[selectedSubject], "subject")}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-text-muted hover:text-text-secondary transition-colors"
                >
                  <Copy size={11} /> {copiedField === "subject" ? "Copied!" : "Copy"}
                </button>
              </div>
              <div className="space-y-1.5">
                {newsletter.subject_options.map((subject, i) => (
                  <label
                    key={i}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      selectedSubject === i
                        ? "bg-accent/10 border border-accent/30"
                        : "hover:bg-bg-elevated border border-transparent"
                    }`}
                  >
                    <input
                      type="radio"
                      name="subject"
                      checked={selectedSubject === i}
                      onChange={() => setSelectedSubject(i)}
                      className="accent-accent"
                    />
                    <span className="text-sm text-text-primary">{subject}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Status */}
          {newsletter && (
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-text-muted uppercase tracking-wider">Status</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                  newsletter.status === "approved" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                }`}>
                  {newsletter.status}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="p-4 mt-auto space-y-2">
            {!newsletter && !generating && (
              <button
                onClick={handleGenerate}
                disabled={!hasTranscript}
                className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
              >
                <Sparkles size={16} /> Generate Newsletter
              </button>
            )}
            {generating && (
              <div className="text-center py-3">
                <Loader2 size={18} className="animate-spin text-accent mx-auto mb-1" />
                <p className="text-xs text-text-secondary">Generating newsletter...</p>
              </div>
            )}
            {newsletter && newsletter.status !== "approved" && (
              <button
                onClick={handleApprove}
                className="w-full flex items-center justify-center gap-2 bg-success/15 hover:bg-success/25 text-success font-medium rounded-lg py-2.5 text-sm transition-colors"
              >
                <CheckCircle2 size={16} /> Approve Newsletter
              </button>
            )}
          </div>
        </div>

        {/* Right Panel (60%) */}
        <div className="w-[60%] bg-bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
          {!newsletter && !generating ? (
            <div className="flex-1 flex items-center justify-center text-text-muted">
              <div className="text-center">
                <Mail size={32} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm mb-1">No newsletter generated yet.</p>
                <p className="text-[11px]">
                  {hasTranscript
                    ? "Click Generate Newsletter to create a Substack post."
                    : "Upload and process a transcript first on the Repurpose page."}
                </p>
              </div>
            </div>
          ) : generating ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Loader2 size={32} className="animate-spin text-accent mx-auto mb-3" />
                <p className="text-sm text-text-secondary mb-1">Generating newsletter...</p>
                <p className="text-[11px] text-text-muted">Writing Substack post from transcript and analysis.</p>
              </div>
            </div>
          ) : newsletter ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Toolbar */}
              <div className="p-3 border-b border-border flex items-center gap-2">
                {/* Tabs */}
                <div className="flex gap-1">
                  {(["main", "notes"] as TabView[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                        activeTab === tab
                          ? "bg-accent/15 text-accent"
                          : "text-text-muted hover:text-text-secondary"
                      }`}
                    >
                      {tab === "main" ? "Main Post" : "Show Notes"}
                    </button>
                  ))}
                </div>
                <div className="flex-1" />
                <button
                  onClick={() =>
                    copyToClipboard(
                      activeTab === "main" ? newsletter.main_content : newsletter.notes_content,
                      activeTab
                    )
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-elevated border border-border text-text-secondary text-sm hover:text-text-primary hover:border-text-muted transition-colors"
                >
                  <Copy size={14} /> {copiedField === activeTab ? "Copied!" : "Copy"}
                </button>
                {editing ? (
                  <>
                    <button
                      onClick={handleSave}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-success/15 text-success text-sm hover:bg-success/25 transition-colors"
                    >
                      <Check size={14} /> Save
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-text-muted text-sm hover:text-text-secondary transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={startEditing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-elevated border border-border text-text-secondary text-sm hover:text-text-primary hover:border-text-muted transition-colors"
                  >
                    <PenLine size={14} /> Edit
                  </button>
                )}
                {newsletter.status === "approved" && (
                  <span className="flex items-center gap-1.5 text-xs text-success">
                    <CheckCircle2 size={14} /> Approved
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {editing ? (
                  <textarea
                    value={activeTab === "main" ? editMain : editNotes}
                    onChange={(e) =>
                      activeTab === "main"
                        ? setEditMain(e.target.value)
                        : setEditNotes(e.target.value)
                    }
                    className="w-full h-full bg-bg-elevated border border-border rounded-lg px-4 py-3 text-sm text-text-primary font-mono text-[13px] leading-relaxed resize-none focus:outline-none focus:border-accent transition-colors"
                  />
                ) : (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                      {activeTab === "main"
                        ? renderMarkdown(newsletter.main_content)
                        : renderMarkdown(newsletter.notes_content)}
                    </div>
                  </div>
                )}

                {/* Substack Notes (collapsible, shown on main tab) */}
                {activeTab === "main" && newsletter.notes_content && !editing && (
                  <div className="mt-6 border-t border-border pt-4">
                    <button
                      onClick={() => setNotesExpanded(!notesExpanded)}
                      className="flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors mb-3"
                    >
                      {notesExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      Substack Notes
                    </button>
                    {notesExpanded && (
                      <div className="bg-bg-elevated border border-border rounded-lg p-4">
                        <div className="prose prose-invert prose-sm max-w-none">
                          <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                            {renderMarkdown(newsletter.notes_content)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function renderMarkdown(content: string) {
  // Simple markdown rendering for preview
  return content.split("\n").map((line, i) => {
    if (line.startsWith("## ")) {
      return (
        <h2 key={i} className="text-lg font-display text-accent mt-6 mb-2">
          {line.slice(3)}
        </h2>
      );
    }
    if (line.startsWith("### ")) {
      return (
        <h3 key={i} className="text-base font-semibold text-text-primary mt-4 mb-1">
          {line.slice(4)}
        </h3>
      );
    }
    if (line.startsWith("> ")) {
      return (
        <blockquote key={i} className="border-l-3 border-accent/40 pl-4 py-2 my-3 bg-accent/5 rounded-r-lg italic text-text-secondary">
          {line.slice(2)}
        </blockquote>
      );
    }
    if (line.startsWith("- ")) {
      return (
        <div key={i} className="flex gap-2 ml-2 my-0.5">
          <span className="text-accent shrink-0">&bull;</span>
          <span>{renderInline(line.slice(2))}</span>
        </div>
      );
    }
    if (line.trim() === "") return <br key={i} />;
    return <p key={i} className="mb-2">{renderInline(line)}</p>;
  });
}

function renderInline(text: string) {
  // Handle **bold** inline
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="text-text-primary font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
