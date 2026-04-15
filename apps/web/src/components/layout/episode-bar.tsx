"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import { NewEpisodeModal } from "@/components/ui/new-episode-modal";
import { StatusPill } from "@/components/ui/status-pill";

function statusToPillType(status: string) {
  if (["delivered", "posted"].includes(status)) return "done" as const;
  if (["recording"].includes(status)) return "live" as const;
  if (status.includes("running") || status.includes("processing"))
    return "in_progress" as const;
  if (["created"].includes(status)) return "planned" as const;
  return "planned" as const;
}

export function EpisodeBar() {
  const {
    currentShow,
    currentEpisode,
    episodes,
    setCurrentEpisode,
    fetchShows,
    fetchEpisodes,
  } = useEpisodeStore();

  const [showModal, setShowModal] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchShows();
  }, [fetchShows]);

  useEffect(() => {
    if (currentShow) {
      fetchEpisodes(currentShow.id);
    }
  }, [currentShow, fetchEpisodes]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <>
      <header className="h-14 bg-bg-surface border-b border-border flex items-center justify-between px-3 sm:px-6 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="relative min-w-0" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-md bg-bg-elevated border border-border hover:border-text-muted transition-colors text-sm min-w-0"
            >
              {currentEpisode ? (
                <>
                  <span className="font-display text-base sm:text-lg text-accent shrink-0">
                    EP {String(currentEpisode.episode_number).padStart(2, "0")}
                  </span>
                  <span className="text-text-secondary hidden sm:inline">—</span>
                  <span className="text-text-primary truncate max-w-[120px] sm:max-w-[200px] hidden sm:inline">
                    {currentEpisode.title}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-display text-lg text-accent">EP</span>
                  <span className="text-text-secondary">—</span>
                  <span className="text-text-primary">Select Episode</span>
                </>
              )}
              <ChevronDown size={14} className="text-text-muted" />
            </button>

            {dropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-80 bg-bg-surface border border-border rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
                {episodes.length === 0 ? (
                  <div className="p-4 text-center text-text-muted text-sm">
                    No episodes yet
                  </div>
                ) : (
                  episodes.map((ep) => (
                    <button
                      key={ep.id}
                      onClick={() => {
                        setCurrentEpisode(ep);
                        setDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-bg-elevated transition-colors ${
                        currentEpisode?.id === ep.id ? "bg-accent/10" : ""
                      }`}
                    >
                      <span className="font-display text-lg text-accent shrink-0">
                        EP {String(ep.episode_number).padStart(2, "0")}
                      </span>
                      <span className="text-sm text-text-primary truncate flex-1">
                        {ep.title}
                      </span>
                      <StatusPill
                        status={statusToPillType(ep.status)}
                        label={ep.status.replace(/_/g, " ")}
                      />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {currentEpisode && (
            <div className="hidden sm:block">
              <StatusPill
                status={statusToPillType(currentEpisode.status)}
                label={currentEpisode.status.replace(/_/g, " ")}
              />
            </div>
          )}
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-md bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors shrink-0"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">New Episode</span>
        </button>
      </header>

      {showModal && <NewEpisodeModal onClose={() => setShowModal(false)} />}
    </>
  );
}
