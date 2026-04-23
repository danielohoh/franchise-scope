"use client";

import { create } from "zustand";

import type { RecommendStoreState } from "@/types/recommend";

export const useRecommendStore = create<RecommendStoreState>((set) => ({
  selectedRegion: null,
  setSelectedRegion: (region) => set({ selectedRegion: region }),

  collectionStatus: "idle",
  collectedCount: 0,
  lastCollectedAt: null,
  setCollectionStatus: (status) => set({ collectionStatus: status }),
  setCollectedCount: (count) => set({ collectedCount: count }),
  setLastCollectedAt: (date) => set({ lastCollectedAt: date }),

  progressCurrent: 0,
  progressTotal: 0,
  progressPage: 0,
  setProgress: (current, total, page) =>
    set({ progressCurrent: current, progressTotal: total, progressPage: page }),
  resetProgress: () =>
    set({ progressCurrent: 0, progressTotal: 0, progressPage: 0 }),

  prompt: "",
  setPrompt: (prompt) => set({ prompt }),
  isAnalyzing: false,
  setIsAnalyzing: (v) => set({ isAnalyzing: v }),

  currentResult: null,
  currentListings: [],
  setCurrentResult: (result, listings = []) =>
    set({ currentResult: result, currentListings: listings }),

  history: [],
  setHistory: (history) => set({ history }),
}));
