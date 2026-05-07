import { create } from "zustand";

type CollectingStatus = "idle" | "loading" | "done" | "error";

export type AnalysisStore = {
  // Step tracking
  step: 1 | 2 | 3; // 1: brand selection, 2: address + options, 3: collecting

  // Selected values
  selectedBrandId: string | null;
  selectedDisclosureId: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  targetSizePyeong: number | null;
  targetFloor: string;
  targetRent: number | null;

  // Collection state
  analysisId: string | null;
  collectingStatus: { [key: string]: CollectingStatus };

  // Actions
  setStep: (step: 1 | 2 | 3) => void;
  setBrand: (brandId: string, disclosureId?: string) => void;
  setLocation: (address: string, lat: number, lng: number) => void;
  setOptions: (opts: { sizePyeong?: number; floor?: string; rent?: number }) => void;
  setAnalysisId: (id: string) => void;
  setCollectingStatus: (key: string, status: CollectingStatus) => void;
  reset: () => void;
};

const initialState = {
  step: 1 as const,
  selectedBrandId: null,
  selectedDisclosureId: null,
  address: "",
  latitude: null,
  longitude: null,
  targetSizePyeong: null,
  targetFloor: "",
  targetRent: null,
  analysisId: null,
  collectingStatus: {} as { [key: string]: CollectingStatus },
};

export const useAnalysisStore = create<AnalysisStore>((set) => ({
  ...initialState,

  setStep: (step) => set({ step }),

  setBrand: (brandId, disclosureId) =>
    set({
      selectedBrandId: brandId,
      selectedDisclosureId: disclosureId ?? null,
    }),

  setLocation: (address, lat, lng) =>
    set({
      address,
      latitude: lat,
      longitude: lng,
    }),

  setOptions: (opts) =>
    set((prev) => ({
      targetSizePyeong:
        typeof opts.sizePyeong === "number" && Number.isFinite(opts.sizePyeong)
          ? opts.sizePyeong
          : prev.targetSizePyeong,
      targetFloor: typeof opts.floor === "string" ? opts.floor : prev.targetFloor,
      targetRent:
        typeof opts.rent === "number" && Number.isFinite(opts.rent) ? opts.rent : prev.targetRent,
    })),

  setAnalysisId: (id) => set({ analysisId: id }),

  setCollectingStatus: (key, status) =>
    set((prev) => ({
      collectingStatus: {
        ...prev.collectingStatus,
        [key]: status,
      },
    })),

  reset: () => set({ ...initialState, collectingStatus: {} }),
}));
