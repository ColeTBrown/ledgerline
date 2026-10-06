/**
 * Cox–Ross–Rubinstein binomial tree for American and European options.
 *
 *   Δt = T/n,  u = e^(σ√Δt),  d = 1/u,  p = (e^((r − q)Δt) − d) / (u − d)
 *   V(i,j) = max(exercise, e^(−rΔt)·[p·V(i+1,j+1) + (1 − p)·V(i+1,j)])   (American)
 */
import { FinanceInputError, assertPositiveInteger } from "../errors";
import type { OptionInputs } from "./black-scholes";
import { blackScholes } from "./black-scholes";

export type ExerciseStyle = "american" | "european";

export interface BinomialNode {
  step: number;
  /** Number of up-moves. */
  ups: number;
  spot: number;
  value: number;
  /** True where early exercise is optimal (American only). */
  exercised: boolean;
}

export interface BinomialResult {
  price: number;
  delta: number;
  gamma: number;
  /** Per year. */
  theta: number;
  /** Price minus the equivalent European value (≥ 0 for American). */
  earlyExercisePremium: number;
  up: number;
  down: number;
  probabilityUp: number;
  /** Full tree, only populated when steps ≤ `maxTreeSteps`. */
  tree: BinomialNode[][] | null;
}

export interface BinomialOptions {
  steps?: number;
  style?: ExerciseStyle;
  /** Largest tree returned for visualization. Default 10. */
  maxTreeSteps?: number;
}

export function binomialPrice(o: OptionInputs, { steps = 200, style = "american", maxTreeSteps = 10 }: BinomialOptions = {}): BinomialResult {
  assertPositiveInteger(steps, "steps");
  if (steps > 5000) throw new FinanceInputError("Steps are limited to 5,000.", "steps");
  // Reuse Black–Scholes validation of the shared inputs.
  const european = blackScholes(o);
  const { type, spot: S, strike: K, timeToExpiry: T, rate: r, volatility: sigma } = o;
  const q = o.dividendYield ?? 0;
  if (T === 0 || sigma === 0) {
    return {
      price: european.price,
      delta: european.delta,
      gamma: 0,
      theta: european.theta,
      earlyExercisePremium: 0,
      up: 1,
      down: 1,
      probabilityUp: 0.5,
      tree: null,
    };
  }

  const dt = T / steps;
  const u = Math.exp(sigma * Math.sqrt(dt));
  const d = 1 / u;
  const p = (Math.exp((r - q) * dt) - d) / (u - d);
  if (!(p > 0 && p < 1)) {
    throw new FinanceInputError("Risk-neutral probability out of range — increase the number of steps.", "steps");
  }
  const disc = Math.exp(-r * dt);
  const sign = type === "call" ? 1 : -1;
  const exercise = (s: number) => Math.max(sign * (s - K), 0);
  const american = style === "american";
  const keepTree = steps <= maxTreeSteps;
  const tree: BinomialNode[][] | null = keepTree ? [] : null;

  // Terminal values.
  let values = new Float64Array(steps + 1);
  for (let j = 0; j <= steps; j++) values[j] = exercise(S * Math.pow(u, j) * Math.pow(d, steps - j));
  if (tree) {
    tree[steps] = Array.from(values, (v, j) => ({ step: steps, ups: j, spot: S * Math.pow(u, 2 * j - steps), value: v, exercised: false }));
  }

  // Values at steps 1 and 2 are kept for delta/gamma/theta.
  let step1: Float64Array | null = null;
  let step2: Float64Array | null = null;
  for (let i = steps - 1; i >= 0; i--) {
    const next = new Float64Array(i + 1);
    const row: BinomialNode[] = [];
    for (let j = 0; j <= i; j++) {
      const cont = disc * (p * values[j + 1]! + (1 - p) * values[j]!);
      const s = S * Math.pow(u, 2 * j - i);
      const ex = american ? exercise(s) : 0;
      const exercised = american && ex > cont + 1e-12;
      next[j] = exercised ? ex : cont;
      if (tree) row.push({ step: i, ups: j, spot: s, value: next[j]!, exercised });
    }
    if (tree) tree[i] = row;
    values = next;
    if (i === 2) step2 = next;
    if (i === 1) step1 = next;
  }

  const price = values[0]!;
  let delta = european.delta;
  let gamma = european.gamma;
  let theta = european.theta;
  if (step1) {
    const su = S * u;
    const sd = S * d;
    delta = (step1[1]! - step1[0]!) / (su - sd);
  }
  if (step2) {
    const suu = S * u * u;
    const sud = S;
    const sdd = S * d * d;
    const dUp = (step2[2]! - step2[1]!) / (suu - sud);
    const dDn = (step2[1]! - step2[0]!) / (sud - sdd);
    gamma = (dUp - dDn) / (0.5 * (suu - sdd));
    theta = (step2[1]! - price) / (2 * dt);
  }

  return {
    price,
    delta,
    gamma,
    theta,
    // Compare with a European tree of the same size so discretization error cancels.
    earlyExercisePremium: american ? price - binomialPrice(o, { steps, style: "european", maxTreeSteps: 0 }).price : 0,
    up: u,
    down: d,
    probabilityUp: p,
    tree,
  };
}
