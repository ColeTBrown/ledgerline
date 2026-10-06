import { describe, expect, it } from "vitest";
import { initLiveField, liveFieldReducer, liveFieldSnapshot, liveFieldStatus } from "@/lib/data/live-field";
import type { Sourced } from "@/lib/data/sourced";

const live = (value: number, asOf = "2026-10-06T19:58:12Z"): Sourced<number> => ({ value, source: "Finnhub", asOf, status: "LIVE" });

describe("live field state machine", () => {
  it("starts MANUAL on the default and follows live data when it arrives", () => {
    let s = initLiveField(100);
    expect(liveFieldStatus(s)).toBe("MANUAL");
    s = liveFieldReducer(s, { type: "live", live: live(231.5) });
    expect(s.value).toBe(231.5);
    expect(liveFieldStatus(s)).toBe("LIVE");
  });
  it("flips to MANUAL on edit and ignores later live updates", () => {
    let s = initLiveField(0, live(231.5));
    s = liveFieldReducer(s, { type: "edit", value: 240, at: "2026-10-06T20:00:00Z" });
    expect(liveFieldStatus(s)).toBe("MANUAL");
    s = liveFieldReducer(s, { type: "live", live: live(232) });
    expect(s.value).toBe(240);
    expect(s.live?.value).toBe(232);
    expect(liveFieldSnapshot(s)).toEqual({ value: 240, source: "Manual input", asOf: "2026-10-06T20:00:00Z", status: "MANUAL" });
  });
  it("reset restores the latest live value", () => {
    let s = initLiveField(0, live(231.5));
    s = liveFieldReducer(s, { type: "edit", value: 240 });
    s = liveFieldReducer(s, { type: "live", live: live(233) });
    s = liveFieldReducer(s, { type: "reset" });
    expect(s.value).toBe(233);
    expect(liveFieldStatus(s)).toBe("LIVE");
    expect(liveFieldSnapshot(s)).toEqual(live(233));
  });
  it("reset without live data is a no-op; losing live data falls back to MANUAL", () => {
    const s = liveFieldReducer(initLiveField(5), { type: "reset" });
    expect(s.value).toBe(5);
    const lost = liveFieldReducer(initLiveField(0, live(10)), { type: "live", live: null });
    expect(liveFieldStatus(lost)).toBe("MANUAL");
    expect(lost.value).toBe(10);
  });
});
