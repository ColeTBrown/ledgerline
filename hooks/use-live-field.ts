"use client";

import { useEffect, useReducer } from "react";
import { initLiveField, liveFieldReducer, liveFieldStatus } from "@/lib/data/live-field";
import type { Sourced } from "@/lib/data/sourced";

/** Live-prefillable numeric field; see lib/data/live-field for semantics. */
export function useLiveField(defaultValue: number, live: Sourced<number> | null) {
  const [state, dispatch] = useReducer(liveFieldReducer, undefined, () => initLiveField(defaultValue, live));
  const liveKey = live ? `${live.value}|${live.asOf}|${live.status}` : "none";
  useEffect(() => {
    dispatch({ type: "live", live });
    // liveKey captures every field of `live` that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveKey]);
  return {
    state,
    value: state.value,
    status: liveFieldStatus(state),
    setValue: (value: number) => dispatch({ type: "edit", value }),
    reset: () => dispatch({ type: "reset" }),
  };
}
