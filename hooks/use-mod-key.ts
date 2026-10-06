"use client";

import { useSyncExternalStore } from "react";
import { isMac } from "@/lib/shortcuts";

const noop = () => () => {};

/** Label for the primary modifier: "⌘" on macOS, "Ctrl" elsewhere (SSR-safe). */
export function useModKey(): string {
  return useSyncExternalStore(noop, () => (isMac() ? "⌘" : "Ctrl"), () => "⌘");
}

/** Label for the Alt/Option modifier. */
export function useAltKey(): string {
  return useSyncExternalStore(noop, () => (isMac() ? "⌥" : "Alt"), () => "⌥");
}
