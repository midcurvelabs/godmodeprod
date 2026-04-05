"use client";

import { create } from "zustand";
import type { Episode, Show, EpisodeStatus } from "@godmodeprod/shared";

interface EpisodeStore {
  currentShow: Show | null;
  currentEpisode: Episode | null;
  episodes: Episode[];
  shows: Show[];
  loading: boolean;
  setCurrentShow: (show: Show | null) => void;
  setCurrentEpisode: (episode: Episode | null) => void;
  setEpisodes: (episodes: Episode[]) => void;
  setShows: (shows: Show[]) => void;
  setLoading: (loading: boolean) => void;
  fetchShows: () => Promise<void>;
  fetchEpisodes: (showId: string) => Promise<void>;
  createEpisode: (data: {
    showId: string;
    episodeNumber: number;
    title: string;
    subtitle?: string;
    recordingDate?: string;
  }) => Promise<Episode | null>;
  updateEpisodeStatus: (episodeId: string, status: EpisodeStatus) => Promise<boolean>;
}

export const useEpisodeStore = create<EpisodeStore>((set, get) => ({
  currentShow: null,
  currentEpisode: null,
  episodes: [],
  shows: [],
  loading: false,
  setCurrentShow: (show) => set({ currentShow: show }),
  setCurrentEpisode: (episode) => set({ currentEpisode: episode }),
  setEpisodes: (episodes) => set({ episodes }),
  setShows: (shows) => set({ shows }),
  setLoading: (loading) => set({ loading }),
  fetchShows: async () => {
    const res = await fetch("/api/shows");
    const json = await res.json();
    if (json.shows) {
      set({ shows: json.shows });
      if (!get().currentShow && json.shows.length > 0) {
        set({ currentShow: json.shows[0] });
      }
    }
  },
  fetchEpisodes: async (showId: string) => {
    set({ loading: true });
    const res = await fetch(`/api/episodes?show_id=${showId}`);
    const json = await res.json();
    if (json.episodes) {
      set({ episodes: json.episodes });
    }
    set({ loading: false });
  },
  createEpisode: async (data) => {
    const res = await fetch("/api/episodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (json.episode) {
      const episodes = [json.episode, ...get().episodes];
      set({ episodes, currentEpisode: json.episode });
      return json.episode;
    }
    return null;
  },
  updateEpisodeStatus: async (episodeId: string, status: EpisodeStatus) => {
    const res = await fetch(`/api/episodes/${episodeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (json.episode) {
      // Update in episodes list
      set({
        episodes: get().episodes.map((e) =>
          e.id === episodeId ? { ...e, status: json.episode.status } : e
        ),
      });
      // Update currentEpisode if it's the one being changed
      const current = get().currentEpisode;
      if (current?.id === episodeId) {
        set({ currentEpisode: { ...current, status: json.episode.status } });
      }
      return true;
    }
    return false;
  },
}));
