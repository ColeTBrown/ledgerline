import { describe, expect, it } from "vitest";
import { bisection, brent, findBrackets, newton, solveRobust } from "@/lib/finance/solvers";

const f = (x: number) => x * x * x - 2 * x - 5; // root ≈ 2.0945514815
const root = 2.0945514815423265;

describe("root finders", () => {
  it("Newton converges from a nearby guess", () => {
    expect(newton(f, (x) => 3 * x * x - 2, 2)).toBeCloseTo(root, 10);
  });
  it("Newton returns null on a zero derivative", () => {
    expect(newton((x) => x * x + 1, () => 0, 1)).toBeNull();
  });
  it("bisection and Brent converge on a bracket", () => {
    expect(bisection(f, 2, 3)).toBeCloseTo(root, 9);
    expect(brent(f, 2, 3)).toBeCloseTo(root, 10);
  });
  it("bracketing methods return null without a sign change", () => {
    expect(bisection(f, 3, 4)).toBeNull();
    expect(brent(f, 3, 4)).toBeNull();
  });
  it("findBrackets locates every sign change", () => {
    const g = (x: number) => (x - 1) * (x - 2) * (x - 3);
    const grid = Array.from({ length: 41 }, (_, i) => i * 0.1 + 0.05);
    expect(findBrackets(g, grid)).toHaveLength(3);
  });
  it("solveRobust falls back to a bracket when Newton fails", () => {
    const g = (x: number) => Math.atan(x - 3); // Newton diverges from far guesses
    const r = solveRobust(g, (x) => 1 / (1 + (x - 3) ** 2), 20, [-10, 0, 10, 30]);
    expect(r).toBeCloseTo(3, 9);
  });
});
