/**
 * State machine for an input that can be pre-filled from a live source.
 *
 * - When live data arrives and the user has not overridden the field, the
 *   value follows the live value and the badge shows its status.
 * - Editing flips the field to MANUAL; later live updates are remembered but
 *   do not overwrite the user's number.
 * - "Reset to live" restores the latest live value.
 */
import type { SourceStatus, Sourced } from "./sourced";

export interface LiveFieldState {
  value: number;
  live: Sourced<number> | null;
  overridden: boolean;
  /** When the user last edited the value (ISO), for scenario snapshots. */
  editedAt: string | null;
}

export type LiveFieldAction =
  | { type: "live"; live: Sourced<number> | null }
  | { type: "edit"; value: number; at?: string }
  | { type: "reset" };

export function initLiveField(defaultValue: number, live: Sourced<number> | null = null): LiveFieldState {
  return { value: live?.value ?? defaultValue, live, overridden: false, editedAt: null };
}

export function liveFieldReducer(state: LiveFieldState, action: LiveFieldAction): LiveFieldState {
  switch (action.type) {
    case "live":
      if (!action.live) return { ...state, live: null };
      return state.overridden ? { ...state, live: action.live } : { ...state, live: action.live, value: action.live.value };
    case "edit":
      return { ...state, value: action.value, overridden: true, editedAt: action.at ?? new Date().toISOString() };
    case "reset":
      return state.live ? { ...state, value: state.live.value, overridden: false, editedAt: null } : state;
  }
}

/** Badge status for the field: MANUAL when overridden or when no live value exists. */
export function liveFieldStatus(state: LiveFieldState): SourceStatus {
  return state.overridden || !state.live ? "MANUAL" : state.live.status;
}

/** Snapshot suitable for saving in a scenario (value plus provenance). */
export function liveFieldSnapshot(state: LiveFieldState): Sourced<number> {
  if (!state.overridden && state.live) return { ...state.live, value: state.value };
  return { value: state.value, source: "Manual input", asOf: state.editedAt ?? new Date().toISOString(), status: "MANUAL" };
}
