/**
 * Cost–volume–profit (break-even) analysis.
 */
import { FinanceInputError, assertFinite, assertNonNegative } from "./errors";

export interface BreakEvenInputs {
  fixedCosts: number;
  pricePerUnit: number;
  variableCostPerUnit: number;
  /** Expected sales volume, for margin of safety and operating leverage. */
  expectedUnits?: number;
  /** Desired operating profit, for target-volume calculation. */
  targetProfit?: number;
}

export interface BreakEvenResult {
  /** Contribution margin per unit: P − VC. */
  contributionMargin: number;
  /** Contribution margin ratio: (P − VC) / P. */
  contributionMarginRatio: number;
  /** Units to break even: FC / (P − VC). */
  breakEvenUnits: number;
  /** Revenue to break even: FC / CM ratio. */
  breakEvenRevenue: number;
  /** Units needed for the target profit: (FC + target) / CM. */
  targetUnits: number | null;
  /** Profit at expected volume: units·CM − FC. */
  expectedProfit: number | null;
  /** Margin of safety: (expected − break-even) / expected. */
  marginOfSafety: number | null;
  /** Degree of operating leverage: total CM / operating profit. Null at zero profit. */
  operatingLeverage: number | null;
}

/**
 * Break-even analysis. Throws when price does not exceed variable cost
 * (no positive contribution margin, so break-even is unreachable).
 */
export function breakEven(inputs: BreakEvenInputs): BreakEvenResult {
  const { fixedCosts, pricePerUnit, variableCostPerUnit, expectedUnits, targetProfit } = inputs;
  assertNonNegative(fixedCosts, "fixedCosts");
  assertNonNegative(pricePerUnit, "pricePerUnit");
  assertNonNegative(variableCostPerUnit, "variableCostPerUnit");
  const cm = pricePerUnit - variableCostPerUnit;
  if (cm <= 0) {
    throw new FinanceInputError("Price must exceed variable cost per unit to break even.", "pricePerUnit");
  }
  const cmRatio = cm / pricePerUnit;
  const breakEvenUnits = fixedCosts / cm;

  let expectedProfit: number | null = null;
  let marginOfSafety: number | null = null;
  let operatingLeverage: number | null = null;
  if (expectedUnits !== undefined) {
    assertNonNegative(expectedUnits, "expectedUnits");
    expectedProfit = expectedUnits * cm - fixedCosts;
    marginOfSafety = expectedUnits > 0 ? (expectedUnits - breakEvenUnits) / expectedUnits : null;
    operatingLeverage = expectedProfit !== 0 ? (expectedUnits * cm) / expectedProfit : null;
  }
  let targetUnits: number | null = null;
  if (targetProfit !== undefined) {
    assertFinite(targetProfit, "targetProfit");
    targetUnits = (fixedCosts + targetProfit) / cm;
  }
  return {
    contributionMargin: cm,
    contributionMarginRatio: cmRatio,
    breakEvenUnits,
    breakEvenRevenue: fixedCosts / cmRatio,
    targetUnits,
    expectedProfit,
    marginOfSafety,
    operatingLeverage,
  };
}
