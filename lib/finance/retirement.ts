/**
 * Deterministic retirement projection.
 *
 * Timing conventions (annual steps):
 * - Accumulation: balance grows for the year, then the year's contribution
 *   is added at year end. Contributions grow at `contributionGrowth`.
 * - Retirement: the year's withdrawal is taken at the start of the year,
 *   then the remainder grows. Withdrawals = (desired income − other income),
 *   both stated in today's dollars and inflated each year.
 */
import { FinanceInputError, assertFinite, assertNonNegative, assertRate } from "./errors";

export interface RetirementInputs {
  currentAge: number;
  retirementAge: number;
  /** Plan horizon: the age the money must last to. */
  planToAge: number;
  currentSavings: number;
  annualContribution: number;
  contributionGrowth: number;
  preRetirementReturn: number;
  postRetirementReturn: number;
  inflation: number;
  /** Desired annual spending in retirement, in today's dollars. */
  desiredIncome: number;
  /** Pension / Social Security etc. in today's dollars, from retirement. */
  otherIncome: number;
}

export interface RetirementYear {
  age: number;
  phase: "accumulation" | "retirement";
  startBalance: number;
  contribution: number;
  withdrawal: number;
  growth: number;
  endBalance: number;
  /** End balance in today's dollars. */
  realEndBalance: number;
}

export interface RetirementResult {
  years: RetirementYear[];
  balanceAtRetirement: number;
  /** Nominal nest egg needed at retirement to fund withdrawals to planToAge. */
  requiredAtRetirement: number;
  /** max(0, required − projected). */
  shortfall: number;
  /** First age at which the balance runs out, or null if it lasts. */
  depletionAge: number | null;
  /** Extra level annual contribution (end of year) that closes the shortfall. */
  additionalAnnualSavingsNeeded: number;
  /** First-year withdrawal in nominal dollars. */
  firstYearWithdrawal: number;
}

function validate(i: RetirementInputs): void {
  for (const k of ["currentAge", "retirementAge", "planToAge"] as const) assertNonNegative(i[k], k);
  if (!(i.currentAge <= i.retirementAge && i.retirementAge < i.planToAge)) {
    throw new FinanceInputError("Ages must satisfy current ≤ retirement < plan-to age.", "retirementAge");
  }
  if (i.planToAge - i.currentAge > 100) throw new FinanceInputError("Plan horizon is limited to 100 years.", "planToAge");
  assertNonNegative(i.currentSavings, "currentSavings");
  assertNonNegative(i.annualContribution, "annualContribution");
  assertNonNegative(i.desiredIncome, "desiredIncome");
  assertNonNegative(i.otherIncome, "otherIncome");
  assertRate(i.preRetirementReturn, "preRetirementReturn");
  assertRate(i.postRetirementReturn, "postRetirementReturn");
  assertRate(i.inflation, "inflation");
  assertFinite(i.contributionGrowth, "contributionGrowth");
}

/** Net withdrawal in nominal dollars for the year starting `yearsFromNow` years out. */
function withdrawalAt(i: RetirementInputs, yearsFromNow: number): number {
  return Math.max(i.desiredIncome - i.otherIncome, 0) * Math.pow(1 + i.inflation, yearsFromNow);
}

export function projectRetirement(i: RetirementInputs): RetirementResult {
  validate(i);
  const yearsToRetirement = i.retirementAge - i.currentAge;
  const yearsInRetirement = i.planToAge - i.retirementAge;
  const years: RetirementYear[] = [];
  let balance = i.currentSavings;
  let depletionAge: number | null = null;

  for (let k = 0; k < yearsToRetirement + yearsInRetirement; k++) {
    const age = i.currentAge + k;
    const startBalance = balance;
    const deflator = Math.pow(1 + i.inflation, k + 1);
    if (k < yearsToRetirement) {
      const contribution = i.annualContribution * Math.pow(1 + i.contributionGrowth, k);
      const growth = startBalance * i.preRetirementReturn;
      balance = startBalance + growth + contribution;
      years.push({ age, phase: "accumulation", startBalance, contribution, withdrawal: 0, growth, endBalance: balance, realEndBalance: balance / deflator });
    } else {
      const desired = withdrawalAt(i, k);
      const withdrawal = Math.min(desired, startBalance);
      const afterWithdrawal = startBalance - withdrawal;
      const growth = afterWithdrawal * i.postRetirementReturn;
      balance = afterWithdrawal + growth;
      if (depletionAge === null && withdrawal < desired - 1e-6) depletionAge = age;
      if (balance <= 1e-6) {
        balance = 0;
        if (depletionAge === null && k < yearsToRetirement + yearsInRetirement - 1) depletionAge = age + 1;
      }
      years.push({ age, phase: "retirement", startBalance, contribution: 0, withdrawal, growth, endBalance: balance, realEndBalance: balance / deflator });
    }
  }

  const balanceAtRetirement = yearsToRetirement === 0 ? i.currentSavings : years[yearsToRetirement - 1]!.endBalance;

  // PV at retirement of a growing annuity due of withdrawals, discounted at the post-retirement return.
  let requiredAtRetirement = 0;
  for (let t = 0; t < yearsInRetirement; t++) {
    requiredAtRetirement += withdrawalAt(i, yearsToRetirement + t) / Math.pow(1 + i.postRetirementReturn, t);
  }
  const shortfall = Math.max(0, requiredAtRetirement - balanceAtRetirement);

  // Level end-of-year contribution with FV = shortfall: shortfall · r / ((1+r)^n − 1).
  let additionalAnnualSavingsNeeded = 0;
  if (shortfall > 0) {
    const r = i.preRetirementReturn;
    const n = yearsToRetirement;
    additionalAnnualSavingsNeeded = n === 0 ? Infinity : r === 0 ? shortfall / n : (shortfall * r) / (Math.pow(1 + r, n) - 1);
  }

  return {
    years,
    balanceAtRetirement,
    requiredAtRetirement,
    shortfall,
    depletionAge,
    additionalAnnualSavingsNeeded,
    firstYearWithdrawal: withdrawalAt(i, yearsToRetirement),
  };
}
