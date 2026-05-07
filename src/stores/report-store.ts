import { create } from "zustand";

export type ReportStore = {
  sections: Partial<Record<string, string>>; // section name → HTML content
  currentSection: string | null;
  isStreaming: boolean;
  isComplete: boolean;
  error: string | null;

  // Actions
  setSectionDelta: (section: string, delta: string) => void;
  setSectionComplete: (section: string, html: string) => void;
  setCurrentSection: (section: string | null) => void;
  setStreaming: (v: boolean) => void;
  setComplete: (v: boolean) => void;
  setError: (msg: string) => void;
  reset: () => void;
};

const initialState = {
  sections: {} as Partial<Record<string, string>>,
  currentSection: null as string | null,
  isStreaming: false,
  isComplete: false,
  error: null as string | null,
};

export const useReportStore = create<ReportStore>((set) => ({
  ...initialState,

  setSectionDelta: (section, delta) =>
    set((prev) => ({
      sections: {
        ...prev.sections,
        [section]: `${prev.sections[section] ?? ""}${delta}`,
      },
    })),

  setSectionComplete: (section, html) =>
    set((prev) => ({
      sections: {
        ...prev.sections,
        [section]: html,
      },
    })),

  setCurrentSection: (section) => set({ currentSection: section }),
  setStreaming: (v) => set({ isStreaming: v }),
  setComplete: (v) => set({ isComplete: v }),
  setError: (msg) => set({ error: msg.trim().length > 0 ? msg : null }),
  reset: () => set({ ...initialState, sections: {} }),
}));
