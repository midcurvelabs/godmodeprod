"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Save,
  Plus,
  Trash2,
  Loader2,
  Check,
  Palette,
  Users,
  Settings2,
} from "lucide-react";
import { useEpisodeStore } from "@/lib/stores/episode-store";

type Tab = "show" | "hosts" | "workflow";

interface ShowFormData {
  name: string;
  slug: string;
  brandColor: string;
  logoUrl: string;
  themeMusicUrl: string;
  description: string;
  tagline: string;
  tone: string;
  audience: string;
}

interface HostFormData {
  id?: string;
  name: string;
  role: string;
  platforms: Record<string, string>;
  voiceCharacteristics: string;
  clipStyle: string;
  photoUrl: string;
}

interface WorkflowFormData {
  episodeStructure: string;
  recordingDay: string;
  publishingSchedule: string;
  contentCadence: string;
}

export default function SettingsPage() {
  const { currentShow } = useEpisodeStore();
  const [tab, setTab] = useState<Tab>("show");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Show config state
  const [showForm, setShowForm] = useState<ShowFormData>({
    name: "",
    slug: "",
    brandColor: "#E8001D",
    logoUrl: "",
    themeMusicUrl: "",
    description: "",
    tagline: "",
    tone: "",
    audience: "",
  });

  // Hosts state
  const [hosts, setHosts] = useState<HostFormData[]>([]);
  const [editingHost, setEditingHost] = useState<HostFormData | null>(null);
  const [addingHost, setAddingHost] = useState(false);

  // Workflow state
  const [workflowForm, setWorkflowForm] = useState<WorkflowFormData>({
    episodeStructure: "Coordinates (3min) → Boot Sequence (5min) → Signal (15min) → God Mode Takes (10min) → Rapid Fire (5min) → Close (2min)",
    recordingDay: "Monday",
    publishingSchedule: "",
    contentCadence: "",
  });

  const loadData = useCallback(async () => {
    if (!currentShow) return;

    // Load show data
    setShowForm((prev) => ({
      ...prev,
      name: currentShow.name || "",
      slug: currentShow.slug || "",
      brandColor: currentShow.brand_color || "#E8001D",
      logoUrl: currentShow.logo_url || "",
      themeMusicUrl: currentShow.theme_music_url || "",
    }));

    // Load show context
    const ctxRes = await fetch(`/api/show-context?show_id=${currentShow.id}`);
    const ctxJson = await ctxRes.json();
    const contexts = ctxJson.contexts || [];

    for (const ctx of contexts) {
      if (ctx.context_type === "soul") {
        setShowForm((prev) => ({
          ...prev,
          description: ctx.content?.description || "",
          tagline: ctx.content?.tagline || "",
          tone: ctx.content?.tone || "",
          audience: ctx.content?.audience || "",
        }));
      }
      if (ctx.context_type === "workflow") {
        setWorkflowForm({
          episodeStructure: ctx.content?.episodeStructure || "",
          recordingDay: ctx.content?.recordingDay || "Monday",
          publishingSchedule: ctx.content?.publishingSchedule || "",
          contentCadence: ctx.content?.contentCadence || "",
        });
      }
    }

    // Load hosts
    const hostsRes = await fetch(`/api/hosts?show_id=${currentShow.id}`);
    const hostsJson = await hostsRes.json();
    setHosts(
      (hostsJson.hosts || []).map((h: Record<string, unknown>) => ({
        id: h.id as string,
        name: h.name as string,
        role: h.role as string,
        platforms: (h.platforms || {}) as Record<string, string>,
        voiceCharacteristics: h.voice_characteristics as string,
        clipStyle: h.clip_style as string,
        photoUrl: (h.photo_url || "") as string,
      }))
    );
  }, [currentShow]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function saveShowConfig() {
    if (!currentShow) return;
    setSaving(true);

    // Update show table
    await fetch(`/api/shows/${currentShow.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: showForm.name,
        slug: showForm.slug,
        brandColor: showForm.brandColor,
        logoUrl: showForm.logoUrl || null,
        themeMusicUrl: showForm.themeMusicUrl || null,
      }),
    });

    // Upsert soul context
    await fetch("/api/show-context", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        showId: currentShow.id,
        contextType: "soul",
        content: {
          name: showForm.name,
          description: showForm.description,
          tagline: showForm.tagline,
          tone: showForm.tone,
          audience: showForm.audience,
        },
      }),
    });

    // Upsert brand context
    await fetch("/api/show-context", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        showId: currentShow.id,
        contextType: "brand",
        content: {
          brandColor: showForm.brandColor,
          logoUrl: showForm.logoUrl,
          themeMusicUrl: showForm.themeMusicUrl,
        },
      }),
    });

    setSaving(false);
    flashSaved();
  }

  async function saveWorkflow() {
    if (!currentShow) return;
    setSaving(true);

    await fetch("/api/show-context", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        showId: currentShow.id,
        contextType: "workflow",
        content: workflowForm,
      }),
    });

    setSaving(false);
    flashSaved();
  }

  async function syncHostsContext() {
    if (!currentShow) return;
    await fetch("/api/show-context", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        showId: currentShow.id,
        contextType: "hosts",
        content: {
          hosts: hosts.map((h) => ({
            name: h.name,
            role: h.role,
            platforms: h.platforms,
            voiceCharacteristics: h.voiceCharacteristics,
            clipStyle: h.clipStyle,
          })),
        },
      }),
    });
  }

  async function saveHost(host: HostFormData) {
    if (!currentShow) return;
    setSaving(true);

    if (host.id) {
      const res = await fetch(`/api/hosts/${host.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: host.name,
          role: host.role,
          platforms: host.platforms,
          voiceCharacteristics: host.voiceCharacteristics,
          clipStyle: host.clipStyle,
          photoUrl: host.photoUrl || null,
        }),
      });
      const json = await res.json();
      if (json.host) {
        setHosts((prev) =>
          prev.map((h) =>
            h.id === host.id
              ? { ...host, id: host.id }
              : h
          )
        );
      }
    } else {
      const res = await fetch("/api/hosts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showId: currentShow.id,
          name: host.name,
          role: host.role,
          platforms: host.platforms,
          voiceCharacteristics: host.voiceCharacteristics,
          clipStyle: host.clipStyle,
          photoUrl: host.photoUrl || null,
          sortOrder: hosts.length,
        }),
      });
      const json = await res.json();
      if (json.host) {
        setHosts((prev) => [
          ...prev,
          {
            id: json.host.id,
            name: host.name,
            role: host.role,
            platforms: host.platforms,
            voiceCharacteristics: host.voiceCharacteristics,
            clipStyle: host.clipStyle,
            photoUrl: host.photoUrl,
          },
        ]);
      }
    }

    setEditingHost(null);
    setAddingHost(false);
    setSaving(false);
    flashSaved();

    // Rebuild hosts context
    await syncHostsContext();
  }

  async function deleteHost(hostId: string) {
    if (!currentShow) return;
    await fetch(`/api/hosts/${hostId}`, { method: "DELETE" });
    setHosts((prev) => prev.filter((h) => h.id !== hostId));
    if (editingHost?.id === hostId) setEditingHost(null);

    // Rebuild hosts context
    await syncHostsContext();
  }

  const tabs = [
    { key: "show" as Tab, label: "Show Config", icon: Palette },
    { key: "hosts" as Tab, label: "Host Profiles", icon: Users },
    { key: "workflow" as Tab, label: "Workflow", icon: Settings2 },
  ];

  if (!currentShow) {
    return (
      <div className="text-center py-16 text-text-muted">
        <p className="text-sm">Select a show to configure settings.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-5xl text-accent mb-1">SHOW CONFIG</h1>
          <p className="text-text-secondary text-sm">
            Configure show identity, host profiles, and workflow.
          </p>
        </div>
        {saved && (
          <span className="flex items-center gap-1.5 text-success text-sm">
            <Check size={16} /> Saved
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-accent text-white"
                : "bg-bg-surface text-text-muted hover:text-text-secondary border border-border"
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Show Config Tab */}
      {tab === "show" && (
        <div className="bg-bg-surface border border-border rounded-lg p-6 space-y-6 max-w-3xl">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
                Show Name
              </label>
              <input
                type="text"
                value={showForm.name}
                onChange={(e) => setShowForm({ ...showForm, name: e.target.value })}
                className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
                Slug
              </label>
              <input
                type="text"
                value={showForm.slug}
                onChange={(e) => setShowForm({ ...showForm, slug: e.target.value })}
                className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
              Tagline
            </label>
            <input
              type="text"
              value={showForm.tagline}
              onChange={(e) => setShowForm({ ...showForm, tagline: e.target.value })}
              placeholder="e.g. Crypto, AI & the Future of the Internet"
              className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
              Description
            </label>
            <textarea
              value={showForm.description}
              onChange={(e) => setShowForm({ ...showForm, description: e.target.value })}
              placeholder="What is this show about? Who is it for?"
              rows={3}
              className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
                Tone of Voice
              </label>
              <input
                type="text"
                value={showForm.tone}
                onChange={(e) => setShowForm({ ...showForm, tone: e.target.value })}
                placeholder="e.g. sharp, builder-first, no fluff"
                className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
                Target Audience
              </label>
              <input
                type="text"
                value={showForm.audience}
                onChange={(e) => setShowForm({ ...showForm, audience: e.target.value })}
                placeholder="e.g. crypto builders, AI devs, founders"
                className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
                Brand Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={showForm.brandColor}
                  onChange={(e) => setShowForm({ ...showForm, brandColor: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer border border-border"
                />
                <input
                  type="text"
                  value={showForm.brandColor}
                  onChange={(e) => setShowForm({ ...showForm, brandColor: e.target.value })}
                  className="flex-1 bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary font-mono focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
                Logo URL
              </label>
              <input
                type="text"
                value={showForm.logoUrl}
                onChange={(e) => setShowForm({ ...showForm, logoUrl: e.target.value })}
                placeholder="https://..."
                className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
                Theme Music URL
              </label>
              <input
                type="text"
                value={showForm.themeMusicUrl}
                onChange={(e) => setShowForm({ ...showForm, themeMusicUrl: e.target.value })}
                placeholder="https://..."
                className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>

          <button
            onClick={saveShowConfig}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save Show Config
          </button>
        </div>
      )}

      {/* Host Profiles Tab */}
      {tab === "hosts" && (
        <div className="space-y-4 max-w-3xl">
          {hosts.map((host) => (
            <div
              key={host.id}
              className="bg-bg-surface border border-border rounded-lg p-4"
            >
              {editingHost && editingHost.id === host.id ? (
                <HostForm
                  host={editingHost}
                  onChange={(h) => setEditingHost(h)}
                  onSave={() => editingHost && saveHost(editingHost)}
                  onCancel={() => setEditingHost(null)}
                  saving={saving}
                />
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base font-semibold text-text-primary">
                        {host.name}
                      </span>
                      {host.role && (
                        <span className="px-2 py-0.5 bg-accent/15 text-accent text-[11px] font-medium rounded">
                          {host.role}
                        </span>
                      )}
                    </div>
                    {host.voiceCharacteristics && (
                      <p className="text-sm text-text-secondary mb-1">
                        <span className="text-text-muted">Voice:</span> {host.voiceCharacteristics}
                      </p>
                    )}
                    {host.clipStyle && (
                      <p className="text-sm text-text-secondary">
                        <span className="text-text-muted">Clip style:</span> {host.clipStyle}
                      </p>
                    )}
                    {Object.keys(host.platforms).length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {Object.entries(host.platforms).map(([platform, handle]) => (
                          <span
                            key={platform}
                            className="px-2 py-0.5 bg-bg-elevated rounded text-[11px] text-text-muted border border-border"
                          >
                            {platform}: {handle}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingHost({ ...host })}
                      className="px-3 py-1.5 bg-bg-elevated border border-border rounded-md text-sm text-text-secondary hover:text-text-primary transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => host.id && deleteHost(host.id)}
                      className="p-1.5 text-text-muted hover:text-error transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {addingHost && editingHost ? (
            <div className="bg-bg-surface border border-border rounded-lg p-4">
              <HostForm
                host={editingHost}
                onChange={(h) => setEditingHost(h)}
                onSave={() => saveHost(editingHost)}
                onCancel={() => { setAddingHost(false); setEditingHost(null); }}
                saving={saving}
              />
            </div>
          ) : (
            <button
              onClick={() => {
                setEditingHost({
                  name: "",
                  role: "",
                  platforms: {},
                  voiceCharacteristics: "",
                  clipStyle: "",
                  photoUrl: "",
                });
                setAddingHost(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-bg-surface border border-dashed border-border rounded-lg text-sm text-text-muted hover:text-text-secondary hover:border-text-muted transition-colors w-full justify-center"
            >
              <Plus size={16} /> Add Host
            </button>
          )}
        </div>
      )}

      {/* Workflow Tab */}
      {tab === "workflow" && (
        <div className="bg-bg-surface border border-border rounded-lg p-6 space-y-6 max-w-3xl">
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
              Episode Structure
            </label>
            <textarea
              value={workflowForm.episodeStructure}
              onChange={(e) => setWorkflowForm({ ...workflowForm, episodeStructure: e.target.value })}
              placeholder="Describe the segment flow of a typical episode..."
              rows={4}
              className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
                Recording Day
              </label>
              <select
                value={workflowForm.recordingDay}
                onChange={(e) => setWorkflowForm({ ...workflowForm, recordingDay: e.target.value })}
                className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
              >
                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(
                  (d) => (
                    <option key={d} value={d}>{d}</option>
                  )
                )}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
                Content Cadence
              </label>
              <input
                type="text"
                value={workflowForm.contentCadence}
                onChange={(e) => setWorkflowForm({ ...workflowForm, contentCadence: e.target.value })}
                placeholder="e.g. 2 episodes/week, daily clips"
                className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
              Publishing Schedule
            </label>
            <textarea
              value={workflowForm.publishingSchedule}
              onChange={(e) => setWorkflowForm({ ...workflowForm, publishingSchedule: e.target.value })}
              placeholder="When does content go out? e.g. YouTube Tuesday/Friday, Twitter daily..."
              rows={3}
              className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-none"
            />
          </div>

          <button
            onClick={saveWorkflow}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save Workflow
          </button>
        </div>
      )}
    </div>
  );
}

function HostForm({
  host,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  host: HostFormData;
  onChange: (h: HostFormData) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [newPlatform, setNewPlatform] = useState("");
  const [newHandle, setNewHandle] = useState("");

  function addPlatform() {
    if (!newPlatform.trim() || !newHandle.trim()) return;
    onChange({
      ...host,
      platforms: { ...host.platforms, [newPlatform.trim()]: newHandle.trim() },
    });
    setNewPlatform("");
    setNewHandle("");
  }

  function removePlatform(key: string) {
    const updated = { ...host.platforms };
    delete updated[key];
    onChange({ ...host, platforms: updated });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
            Name
          </label>
          <input
            type="text"
            value={host.name}
            onChange={(e) => onChange({ ...host, name: e.target.value })}
            className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
            Role
          </label>
          <input
            type="text"
            value={host.role}
            onChange={(e) => onChange({ ...host, role: e.target.value })}
            placeholder="e.g. Host, Co-host, Producer"
            className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
          Voice Characteristics
        </label>
        <input
          type="text"
          value={host.voiceCharacteristics}
          onChange={(e) => onChange({ ...host, voiceCharacteristics: e.target.value })}
          placeholder="e.g. high energy, technical depth, concise takes"
          className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      <div>
        <label className="block text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
          Clip Style
        </label>
        <input
          type="text"
          value={host.clipStyle}
          onChange={(e) => onChange({ ...host, clipStyle: e.target.value })}
          placeholder="e.g. punchy one-liners, deep dive explanations"
          className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      <div>
        <label className="block text-[11px] font-medium uppercase tracking-wider text-text-muted mb-1.5">
          Platforms
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {Object.entries(host.platforms).map(([platform, handle]) => (
            <span
              key={platform}
              className="flex items-center gap-1.5 px-2 py-1 bg-bg-elevated rounded text-sm text-text-secondary border border-border"
            >
              {platform}: {handle}
              <button onClick={() => removePlatform(platform)} className="text-text-muted hover:text-error">
                <Trash2 size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newPlatform}
            onChange={(e) => setNewPlatform(e.target.value)}
            placeholder="Platform"
            className="w-28 bg-bg-elevated border border-border rounded-md px-2 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
          />
          <input
            type="text"
            value={newHandle}
            onChange={(e) => setNewHandle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addPlatform()}
            placeholder="@handle"
            className="flex-1 bg-bg-elevated border border-border rounded-md px-2 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
          />
          <button
            onClick={addPlatform}
            disabled={!newPlatform.trim() || !newHandle.trim()}
            className="px-3 py-1.5 bg-bg-elevated border border-border rounded-md text-sm text-text-secondary hover:border-accent disabled:opacity-50 transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={onSave}
          disabled={!host.name.trim() || saving}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save Host
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-bg-elevated border border-border rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
