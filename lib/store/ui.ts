"use client";

import { create } from "zustand";

/** Ephemeral UI state (not persisted). */
interface UiState {
  paletteOpen: boolean;
  settingsOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
}

export const useUi = create<UiState>()((set) => ({
  paletteOpen: false,
  settingsOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
}));
