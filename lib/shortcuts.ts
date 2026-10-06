/** True on Apple platforms, where Cmd replaces Ctrl in shortcuts. */
export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

/** Primary modifier pressed (Cmd on macOS, Ctrl elsewhere). */
export function hasMod(e: KeyboardEvent): boolean {
  return isMac() ? e.metaKey : e.ctrlKey;
}

/** True when focus is in a text field, where single-key shortcuts must not fire. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}
