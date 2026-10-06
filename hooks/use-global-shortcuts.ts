"use client";

import { useEffect } from "react";
import { ROLE_IDS } from "@/config/roles";
import { hasMod } from "@/lib/shortcuts";
import { useSettings } from "@/lib/store/settings";
import { useUi } from "@/lib/store/ui";

/**
 * Workstation-wide keyboard shortcuts.
 *  Mod+K       command palette
 *  Alt+1…5     switch role (Mod+digit is reserved by browsers for tab switching)
 *  Mod+B       toggle sidebar
 *  Mod+.       toggle right panel
 *  Mod+,       settings
 */
export function useGlobalShortcuts() {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = hasMod(e);
      const key = e.key.toLowerCase();

      if (mod && key === "k") {
        e.preventDefault();
        const ui = useUi.getState();
        ui.setPaletteOpen(!ui.paletteOpen);
        return;
      }
      if (e.altKey && !mod && /^Digit[1-5]$/.test(e.code)) {
        e.preventDefault();
        const role = ROLE_IDS[Number(e.code.slice(5)) - 1];
        if (role) useSettings.getState().setRole(role);
        return;
      }
      if (mod && key === "b") {
        e.preventDefault();
        useSettings.getState().toggleSidebar();
        return;
      }
      if (mod && key === ".") {
        e.preventDefault();
        useSettings.getState().toggleRightPanel();
        return;
      }
      if (mod && key === ",") {
        e.preventDefault();
        useUi.getState().setSettingsOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
