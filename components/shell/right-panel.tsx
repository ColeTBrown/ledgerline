"use client";

import { X } from "lucide-react";
import { useSettings } from "@/lib/store/settings";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** Optional right-hand panel for assumptions and working notes. */
export function RightPanel() {
  const open = useSettings((s) => s.rightPanelOpen);
  const toggle = useSettings((s) => s.toggleRightPanel);
  const notes = useSettings((s) => s.notes);
  const setNotes = useSettings((s) => s.setNotes);

  if (!open) return null;
  return (
    <aside aria-label="Notes" className="hidden w-72 shrink-0 flex-col border-l border-border bg-surface md:flex">
      <div className="flex h-9 items-center justify-between border-b border-border pr-1.5 pl-3">
        <h2 className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Notes & Assumptions</h2>
        <Button variant="ghost" size="icon-xs" onClick={toggle} aria-label="Close notes panel">
          <X />
        </Button>
      </div>
      <div className="flex flex-1 flex-col p-3">
        <label htmlFor="workspace-notes" className="sr-only">
          Workspace notes
        </label>
        <Textarea
          id="workspace-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Record assumptions, sources and open questions. Saved locally."
          className="flex-1 resize-none font-mono text-xs leading-relaxed"
        />
      </div>
    </aside>
  );
}
