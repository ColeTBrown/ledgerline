/**
 * Mean–variance portfolio analytics (Markowitz).
 *
 *   E[R_p] = wᵀμ,   σ_p² = wᵀΣw,   Sharpe = (E[R_p] − r_f) / σ_p
 *   Σ_ij  = ρ_ij·σ_i·σ_j
 */
import { FinanceInputError, assertFinite, assertNonNegative } from "./errors";

export type Matrix = number[][];

/** Build Σ from volatilities and a correlation matrix (validated symmetric, unit diagonal, |ρ| ≤ 1). */
export function covarianceMatrix(vols: readonly number[], correlation: readonly (readonly number[])[]): Matrix {
  const n = vols.length;
  if (n === 0) throw new FinanceInputError("Add at least one asset.", "assets");
  if (correlation.length !== n || correlation.some((row) => row.length !== n)) {
    throw new FinanceInputError("Correlation matrix must be n × n.", "correlation");
  }
  vols.forEach((v, i) => assertNonNegative(v, `volatility[${i}]`));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const r = correlation[i]![j]!;
      assertFinite(r, "correlation");
      if (r < -1 || r > 1) throw new FinanceInputError("Correlations must be between −1 and 1.", "correlation");
      if (i === j && Math.abs(r - 1) > 1e-9) throw new FinanceInputError("Correlation diagonal must be 1.", "correlation");
      if (Math.abs(r - correlation[j]![i]!) > 1e-9) throw new FinanceInputError("Correlation matrix must be symmetric.", "correlation");
    }
  }
  return vols.map((vi, i) => vols.map((vj, j) => correlation[i]![j]! * vi * vj));
}

/** Correlation matrix with a constant off-diagonal ρ. */
export function constantCorrelation(n: number, rho: number): Matrix {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : rho)));
}

/** wᵀμ */
export function portfolioReturn(weights: readonly number[], expectedReturns: readonly number[]): number {
  if (weights.length !== expectedReturns.length) throw new FinanceInputError("Weights and returns must align.", "weights");
  return weights.reduce((s, w, i) => s + w * expectedReturns[i]!, 0);
}

/** wᵀΣw */
export function portfolioVariance(weights: readonly number[], cov: Matrix): number {
  let v = 0;
  for (let i = 0; i < weights.length; i++) {
    const row = cov[i]!;
    for (let j = 0; j < weights.length; j++) v += weights[i]! * weights[j]! * row[j]!;
  }
  return Math.max(v, 0);
}

/** √(wᵀΣw) */
export function portfolioVolatility(weights: readonly number[], cov: Matrix): number {
  return Math.sqrt(portfolioVariance(weights, cov));
}

/** (E[R] − r_f) / σ; null when σ = 0. */
export function sharpeRatio(expectedReturn: number, volatility: number, riskFreeRate: number): number | null {
  return volatility > 0 ? (expectedReturn - riskFreeRate) / volatility : null;
}

/** Normalize market values to weights summing to 1. */
export function weightsFromValues(values: readonly number[]): number[] {
  const total = values.reduce((s, v) => s + v, 0);
  if (!(total > 0)) throw new FinanceInputError("Portfolio value must be greater than zero.", "values");
  return values.map((v) => v / total);
}

/**
 * Euclidean projection onto the probability simplex {w ≥ 0, Σw = 1}
 * (Duchi et al., 2008).
 */
export function projectToSimplex(v: readonly number[]): number[] {
  const u = [...v].sort((a, b) => b - a);
  let css = 0;
  let theta = 0;
  for (let i = 0; i < u.length; i++) {
    css += u[i]!;
    const t = (css - 1) / (i + 1);
    if (u[i]! - t > 0) theta = t;
  }
  return v.map((x) => Math.max(x - theta, 0));
}

/**
 * Long-only mean–variance optimum for risk tolerance λ:
 *   minimize wᵀΣw − λ·wᵀμ  subject to  w ≥ 0, Σw = 1
 * solved by accelerated projected gradient descent (FISTA). λ = 0 gives the
 * minimum-variance portfolio; large λ approaches the highest-return asset.
 */
export function optimizeLongOnly(mu: readonly number[], cov: Matrix, lambda: number, iterations = 2000): number[] {
  const n = mu.length;
  // Lipschitz constant of the gradient 2Σw ≤ 2·max row sum of |Σ|.
  const L = 2 * Math.max(...cov.map((row) => row.reduce((s, x) => s + Math.abs(x), 0)), 1e-12);
  const step = 1 / L;
  let w = Array(n).fill(1 / n) as number[];
  let y = [...w];
  let t = 1;
  for (let k = 0; k < iterations; k++) {
    const grad = y.map((_, i) => 2 * cov[i]!.reduce((s, c, j) => s + c * y[j]!, 0) - lambda * mu[i]!);
    const next = projectToSimplex(y.map((yi, i) => yi - step * grad[i]!));
    const tNext = (1 + Math.sqrt(1 + 4 * t * t)) / 2;
    y = next.map((x, i) => x + ((t - 1) / tNext) * (x - w[i]!));
    const delta = next.reduce((s, x, i) => s + Math.abs(x - w[i]!), 0);
    w = next;
    t = tNext;
    if (delta < 1e-12) break;
  }
  return w;
}

export interface FrontierPoint {
  weights: number[];
  expectedReturn: number;
  volatility: number;
  sharpe: number | null;
}

/**
 * Long-only efficient frontier: optimal portfolios across a sweep of risk
 * tolerances, from minimum variance to maximum return, sorted by volatility
 * with dominated points removed.
 */
export function efficientFrontier(mu: readonly number[], cov: Matrix, riskFreeRate: number, points = 40): FrontierPoint[] {
  if (mu.length !== cov.length) throw new FinanceInputError("Returns and covariance must align.", "assets");
  const scale = Math.max(...cov.map((r, i) => r[i]!), 1e-8) / Math.max(Math.max(...mu.map(Math.abs)), 1e-8);
  const lambdas = [0, ...Array.from({ length: points - 1 }, (_, k) => scale * Math.pow(10, -3 + (5 * k) / (points - 2)))];
  const raw = lambdas.map((lam) => {
    const w = optimizeLongOnly(mu, cov, lam);
    const r = portfolioReturn(w, mu);
    const v = portfolioVolatility(w, cov);
    return { weights: w, expectedReturn: r, volatility: v, sharpe: sharpeRatio(r, v, riskFreeRate) };
  });
  raw.sort((a, b) => a.volatility - b.volatility);
  const frontier: FrontierPoint[] = [];
  for (const p of raw) {
    const last = frontier[frontier.length - 1];
    if (!last || p.expectedReturn > last.expectedReturn + 1e-10) frontier.push(p);
  }
  return frontier;
}

/** Minimum-variance long-only portfolio. */
export function minimumVariancePortfolio(mu: readonly number[], cov: Matrix, riskFreeRate: number): FrontierPoint {
  const w = optimizeLongOnly(mu, cov, 0, 5000);
  const r = portfolioReturn(w, mu);
  const v = portfolioVolatility(w, cov);
  return { weights: w, expectedReturn: r, volatility: v, sharpe: sharpeRatio(r, v, riskFreeRate) };
}

/**
 * Maximum-Sharpe (tangency) long-only portfolio, found by golden-section
 * search over the frontier's risk-tolerance parameter.
 */
export function maxSharpePortfolio(mu: readonly number[], cov: Matrix, riskFreeRate: number): FrontierPoint {
  const evaluate = (logLam: number): FrontierPoint => {
    const w = optimizeLongOnly(mu, cov, Math.pow(10, logLam));
    const r = portfolioReturn(w, mu);
    const v = portfolioVolatility(w, cov);
    return { weights: w, expectedReturn: r, volatility: v, sharpe: sharpeRatio(r, v, riskFreeRate) };
  };
  const score = (p: FrontierPoint) => p.sharpe ?? -Infinity;
  // Coarse scan to locate the peak, then golden-section refinement.
  const grid = Array.from({ length: 25 }, (_, k) => -4 + k * 0.33);
  let bestIdx = 0;
  let best = evaluate(grid[0]!);
  grid.forEach((g, k) => {
    const p = evaluate(g);
    if (score(p) > score(best)) {
      best = p;
      bestIdx = k;
    }
  });
  let a = grid[Math.max(bestIdx - 1, 0)]!;
  let b = grid[Math.min(bestIdx + 1, grid.length - 1)]!;
  const phi = (Math.sqrt(5) - 1) / 2;
  for (let k = 0; k < 30; k++) {
    const c = b - phi * (b - a);
    const d = a + phi * (b - a);
    if (score(evaluate(c)) > score(evaluate(d))) b = d;
    else a = c;
  }
  const refined = evaluate((a + b) / 2);
  return score(refined) >= score(best) ? refined : best;
}
