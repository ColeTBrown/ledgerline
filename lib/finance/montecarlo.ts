/**
 * Monte Carlo simulation of a savings-then-spending plan.
 *
 * Annual returns are lognormal with arithmetic mean m and standard deviation s:
 *   σ_ln² = ln(1 + s²/(1 + m)²),  μ_ln = ln(1 + m) − σ_ln²/2
 *   R = exp(μ_ln + σ_ln·Z) − 1,   Z ~ N(0, 1)
 * Timing matches {@link projectRetirement}: contributions at year end during
 * accumulation; inflation-adjusted withdrawals at year start in retirement.
 * A path fails if the balance cannot fund a year's withdrawal in full.
 */
import { FinanceInputError, assertFinite, assertNonNegative, assertPositiveInteger, assertRate } from "./errors";
import { mulberry32, normalGenerator } from "./rng";
import { percentileSorted } from "./stats";

export interface MonteCarloInputs {
  initialBalance: number;
  annualContribution: number;
  contributionGrowth: number;
  yearsToRetirement: number;
  yearsInRetirement: number;
  /** First-year withdrawal in today's dollars; grows with inflation. */
  annualWithdrawal: number;
  /** Arithmetic mean annual return. */
  expectedReturn: number;
  /** Annual return standard deviation. */
  volatility: number;
  inflation: number;
  /** 100–10,000 paths. */
  simulations: number;
  seed?: number;
}

export const PERCENTILES = [0.05, 0.25, 0.5, 0.75, 0.95] as const;

export interface MonteCarloYear {
  year: number;
  /** Balances at the listed PERCENTILES (nominal). */
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  /** Share of paths still solvent at year end. */
  survival: number;
}

export interface MonteCarloResult {
  years: MonteCarloYear[];
  /** Share of paths that fund every withdrawal through the horizon. */
  successProbability: number;
  medianEndingBalance: number;
  /** Ending balances, ascending (for histograms). */
  endingBalances: Float64Array;
  /** Count of failures by year of failure (index = year − 1). */
  failuresByYear: number[];
}

/** Lognormal parameters matching an arithmetic mean and standard deviation. */
export function lognormalParams(mean: number, sd: number): { mu: number; sigma: number } {
  assertRate(mean, "expectedReturn");
  assertNonNegative(sd, "volatility");
  const sigma2 = Math.log(1 + (sd * sd) / ((1 + mean) * (1 + mean)));
  return { mu: Math.log(1 + mean) - sigma2 / 2, sigma: Math.sqrt(sigma2) };
}

export function runMonteCarlo(i: MonteCarloInputs): MonteCarloResult {
  assertNonNegative(i.initialBalance, "initialBalance");
  assertNonNegative(i.annualContribution, "annualContribution");
  assertFinite(i.contributionGrowth, "contributionGrowth");
  assertNonNegative(i.yearsToRetirement, "yearsToRetirement");
  assertPositiveInteger(i.yearsInRetirement, "yearsInRetirement");
  assertNonNegative(i.annualWithdrawal, "annualWithdrawal");
  assertRate(i.inflation, "inflation");
  assertPositiveInteger(i.simulations, "simulations");
  if (!Number.isInteger(i.yearsToRetirement)) throw new FinanceInputError("Years to retirement must be a whole number.", "yearsToRetirement");
  if (i.simulations < 100 || i.simulations > 10000) throw new FinanceInputError("Simulations must be between 100 and 10,000.", "simulations");
  const horizon = i.yearsToRetirement + i.yearsInRetirement;
  if (horizon > 100) throw new FinanceInputError("Horizon is limited to 100 years.", "yearsInRetirement");

  const { mu, sigma } = lognormalParams(i.expectedReturn, i.volatility);
  const normal = normalGenerator(mulberry32(i.seed ?? 42));
  const n = i.simulations;
  // balances[year * n + path]
  const balances = new Float64Array(horizon * n);
  const failedAt = new Int32Array(n).fill(-1);

  for (let p = 0; p < n; p++) {
    let balance = i.initialBalance;
    for (let y = 0; y < horizon; y++) {
      const ret = Math.exp(mu + sigma * normal()) - 1;
      if (y < i.yearsToRetirement) {
        balance = balance * (1 + ret) + i.annualContribution * Math.pow(1 + i.contributionGrowth, y);
      } else if (failedAt[p] === -1) {
        const withdrawal = i.annualWithdrawal * Math.pow(1 + i.inflation, y);
        if (balance < withdrawal) {
          failedAt[p] = y;
          balance = 0;
        } else {
          balance = (balance - withdrawal) * (1 + ret);
        }
      }
      balances[y * n + p] = balance;
    }
  }

  const years: MonteCarloYear[] = [];
  const column = new Float64Array(n);
  for (let y = 0; y < horizon; y++) {
    let alive = 0;
    for (let p = 0; p < n; p++) {
      column[p] = balances[y * n + p]!;
      if (failedAt[p] === -1 || failedAt[p]! > y) alive++;
    }
    column.sort();
    years.push({
      year: y + 1,
      p5: percentileSorted(column, 0.05),
      p25: percentileSorted(column, 0.25),
      p50: percentileSorted(column, 0.5),
      p75: percentileSorted(column, 0.75),
      p95: percentileSorted(column, 0.95),
      survival: alive / n,
    });
  }

  const endingBalances = new Float64Array(n);
  for (let p = 0; p < n; p++) endingBalances[p] = balances[(horizon - 1) * n + p]!;
  endingBalances.sort();
  const failuresByYear = Array(horizon).fill(0) as number[];
  let failures = 0;
  for (let p = 0; p < n; p++) {
    if (failedAt[p]! >= 0) {
      failures++;
      failuresByYear[failedAt[p]!]!++;
    }
  }

  return {
    years,
    successProbability: 1 - failures / n,
    medianEndingBalance: percentileSorted(endingBalances, 0.5),
    endingBalances,
    failuresByYear,
  };
}
