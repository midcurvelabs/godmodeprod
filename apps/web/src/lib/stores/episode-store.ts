import { create } from "zustand";
import type { Episode, Show } from "@godmodeprod/shared";

interface EpisodeStore {
  currentShow: Show | null;
  currentEpisode: Episode | null;
  episodes: Episode[];
  setCurrentShow: (show: Show | null) => void;
  setCurrentEpisode: (episode: Episode | null) => void;
  setEpisodes: (episodes: Episode[]) => void;
}

export const useEpisodeStore = create<EpisodeStore>((set) => ({
  currentShow: null,
  currentEpisode: null,
  episodes: [],
  setCurrentShow: (show) => set({ currentShow: show }),
  setCurrentEpisode: (episode) => set({ currentEpisode: episode }),
  setEpisodes: (episodes) => set({ episodes }),
}));
