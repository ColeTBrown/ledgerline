/**
 * Cost of capital.
 */
import { FinanceInputError, assertFinite, assertNonNegative } from "../errors";

export interface CapmInputs {
  riskFreeRate: number;
  beta: number;
  /** Expected market return minus risk-free rate. */
  equityRiskPremium: number;
  /** Optional size / company-specific premium. */
  sizePremium?: number;
  /** Optional country risk premium. */
  countryRiskPremium?: number;
}

/** CAPM cost of equity: r_e = r_f + β·ERP + size premium + country premium. */
export function costOfEquityCapm(i: CapmInputs): number {
  assertFinite(i.riskFreeRate, "riskFreeRate");
  assertFinite(i.beta, "beta");
  assertFinite(i.equityRiskPremium, "equityRiskPremium");
  return i.riskFreeRate + i.beta * i.equityRiskPremium + (i.sizePremium ?? 0) + (i.countryRiskPremium ?? 0);
}

/** After-tax cost of debt: r_d·(1 − t). */
export function afterTaxCostOfDebt(preTaxCostOfDebt: number, taxRate: number): number {
  assertFinite(preTaxCostOfDebt, "preTaxCostOfDebt");
  assertTaxRate(taxRate);
  return preTaxCostOfDebt * (1 - taxRate);
}

function assertTaxRate(taxRate: number): void {
  assertFinite(taxRate, "taxRate");
  if (taxRate < 0 || taxRate >= 1) throw new FinanceInputError("Tax rate must be between 0% and 100%.", "taxRate");
}

export interface WaccInputs {
  /** Market value of equity. */
  equityValue: number;
  /** Market (or book) value of debt. */
  debtValue: number;
  costOfEquity: number;
  preTaxCostOfDebt: number;
  taxRate: number;
  preferredValue?: number;
  costOfPreferred?: number;
}

export interface WaccResult {
  wacc: number;
  equityWeight: number;
  debtWeight: number;
  preferredWeight: number;
  afterTaxCostOfDebt: number;
}

/**
 * Weighted average cost of capital:
 *   WACC = E/V·r_e + D/V·r_d·(1 − t) + P/V·r_p,   V = E + D + P
 */
export function wacc(i: WaccInputs): WaccResult {
  assertNonNegative(i.equityValue, "equityValue");
  assertNonNegative(i.debtValue, "debtValue");
  assertFinite(i.costOfEquity, "costOfEquity");
  const pref = i.preferredValue ?? 0;
  assertNonNegative(pref, "preferredValue");
  const v = i.equityValue + i.debtValue + pref;
  if (v === 0) throw new FinanceInputError("Total capital must be greater than zero.", "equityValue");
  const rdAfterTax = afterTaxCostOfDebt(i.preTaxCostOfDebt, i.taxRate);
  const we = i.equityValue / v;
  const wd = i.debtValue / v;
  const wp = pref / v;
  return {
    wacc: we * i.costOfEquity + wd * rdAfterTax + wp * (i.costOfPreferred ?? 0),
    equityWeight: we,
    debtWeight: wd,
    preferredWeight: wp,
    afterTaxCostOfDebt: rdAfterTax,
  };
}

/** Hamada unlevered (asset) beta: β_U = β_L / [1 + (1 − t)·D/E]. */
export function unleverBeta(leveredBeta: number, debtToEquity: number, taxRate: number): number {
  assertFinite(leveredBeta, "beta");
  assertNonNegative(debtToEquity, "debtToEquity");
  assertTaxRate(taxRate);
  return leveredBeta / (1 + (1 - taxRate) * debtToEquity);
}

/** Hamada relevered beta: β_L = β_U·[1 + (1 − t)·D/E]. */
export function releverBeta(unleveredBeta: number, debtToEquity: number, taxRate: number): number {
  assertFinite(unleveredBeta, "beta");
  assertNonNegative(debtToEquity, "debtToEquity");
  assertTaxRate(taxRate);
  return unleveredBeta * (1 + (1 - taxRate) * debtToEquity);
}
