/**
 * Unlevered discounted cash flow model.
 *
 * Per projection year t:
 *   Revenue_t = Revenue_{t−1}·(1 + g_t)
 *   EBIT_t    = Revenue_t·margin_t
 *   FCF_t     = EBIT_t·(1 − tax) + D&A_t − CapEx_t − ΔNWC_t
 * where D&A, CapEx are % of revenue and NWC is a % of revenue (so
 * ΔNWC_t = nwc%·(Revenue_t − Revenue_{t−1})).
 *
 * Terminal value at year N:
 *   Gordon growth: TV = FCF_N·(1 + g) / (WACC − g)
 *   Exit multiple: TV = EBITDA_N · multiple
 * Enterprise value = Σ FCF_t·DF_t + TV·DF_N, with DF_t = (1 + WACC)^−t
 * (t − 0.5 under the mid-year convention; TV is always discounted N years).
 */
import { FinanceInputError, assertFinite, assertPositive, assertRate } from "../errors";

export type TerminalMethod =
  | { method: "gordon"; growth: number }
  | { method: "exit-multiple"; multiple: number };

export interface DcfInputs {
  /** Last actual (base-year) revenue. */
  baseRevenue: number;
  /** Revenue growth for each projection year; length = projection years. */
  revenueGrowth: readonly number[];
  /** EBIT margin — a single value or one per year. */
  ebitMargin: number | readonly number[];
  taxRate: number;
  daPctRevenue: number;
  capexPctRevenue: number;
  nwcPctRevenue: number;
  wacc: number;
  terminal: TerminalMethod;
  midYear?: boolean;
  /** Debt − cash (and other claims). Negative for net cash. */
  netDebt: number;
  sharesOutstanding: number;
  /** For upside/downside display. */
  currentPrice?: number;
}

export interface DcfYear {
  year: number;
  revenue: number;
  growth: number;
  ebit: number;
  ebitda: number;
  nopat: number;
  da: number;
  capex: number;
  changeInNwc: number;
  fcf: number;
  discountFactor: number;
  pvFcf: number;
}

export interface DcfResult {
  years: DcfYear[];
  sumPvFcf: number;
  terminalValue: number;
  pvTerminalValue: number;
  enterpriseValue: number;
  equityValue: number;
  valuePerShare: number;
  upside: number | null;
  /** Share of EV coming from the terminal value. */
  terminalShareOfEv: number;
  /** For Gordon: implied EV/EBITDA at exit. For exit multiple: implied perpetual growth. */
  impliedExitMultiple: number;
  impliedPerpetualGrowth: number | null;
}

function marginFor(m: number | readonly number[], i: number): number {
  if (typeof m === "number") return m;
  const v = m[i] ?? m[m.length - 1];
  if (v === undefined) throw new FinanceInputError("Provide at least one EBIT margin.", "ebitMargin");
  return v;
}

/** Run the DCF. Throws on invalid inputs (e.g. WACC ≤ terminal growth). */
export function runDcf(i: DcfInputs): DcfResult {
  assertPositive(i.baseRevenue, "baseRevenue");
  if (i.revenueGrowth.length === 0 || i.revenueGrowth.length > 30) {
    throw new FinanceInputError("Projection must be between 1 and 30 years.", "revenueGrowth");
  }
  i.revenueGrowth.forEach((g, k) => assertRate(g, `revenueGrowth[${k}]`));
  assertFinite(i.taxRate, "taxRate");
  assertRate(i.wacc, "wacc");
  if (i.wacc <= 0) throw new FinanceInputError("WACC must be greater than zero.", "wacc");
  assertFinite(i.netDebt, "netDebt");
  assertPositive(i.sharesOutstanding, "sharesOutstanding");

  const years: DcfYear[] = [];
  let prevRevenue = i.baseRevenue;
  for (let k = 0; k < i.revenueGrowth.length; k++) {
    const t = k + 1;
    const growth = i.revenueGrowth[k]!;
    const revenue = prevRevenue * (1 + growth);
    const ebit = revenue * marginFor(i.ebitMargin, k);
    const da = revenue * i.daPctRevenue;
    const capex = revenue * i.capexPctRevenue;
    const changeInNwc = i.nwcPctRevenue * (revenue - prevRevenue);
    const nopat = ebit * (1 - i.taxRate);
    const fcf = nopat + da - capex - changeInNwc;
    const discountFactor = Math.pow(1 + i.wacc, -(i.midYear ? t - 0.5 : t));
    years.push({ year: t, revenue, growth, ebit, ebitda: ebit + da, nopat, da, capex, changeInNwc, fcf, discountFactor, pvFcf: fcf * discountFactor });
    prevRevenue = revenue;
  }

  const last = years[years.length - 1]!;
  const n = last.year;
  let terminalValue: number;
  if (i.terminal.method === "gordon") {
    const g = i.terminal.growth;
    assertFinite(g, "terminalGrowth");
    if (i.wacc <= g) throw new FinanceInputError("WACC must exceed the terminal growth rate.", "terminalGrowth");
    terminalValue = (last.fcf * (1 + g)) / (i.wacc - g);
  } else {
    assertFinite(i.terminal.multiple, "exitMultiple");
    terminalValue = last.ebitda * i.terminal.multiple;
  }

  const tvDiscount = Math.pow(1 + i.wacc, -n);
  const pvTerminalValue = terminalValue * tvDiscount;
  const sumPvFcf = years.reduce((s, y) => s + y.pvFcf, 0);
  const enterpriseValue = sumPvFcf + pvTerminalValue;
  const equityValue = enterpriseValue - i.netDebt;
  const valuePerShare = equityValue / i.sharesOutstanding;
  const denom = terminalValue + last.fcf;
  return {
    years,
    sumPvFcf,
    terminalValue,
    pvTerminalValue,
    enterpriseValue,
    equityValue,
    valuePerShare,
    upside: i.currentPrice && i.currentPrice > 0 ? valuePerShare / i.currentPrice - 1 : null,
    terminalShareOfEv: enterpriseValue !== 0 ? pvTerminalValue / enterpriseValue : 0,
    impliedExitMultiple: last.ebitda !== 0 ? terminalValue / last.ebitda : Number.NaN,
    // From TV = FCF(1+g)/(WACC−g): g = (TV·WACC − FCF) / (TV + FCF).
    impliedPerpetualGrowth: denom !== 0 ? (terminalValue * i.wacc - last.fcf) / denom : null,
  };
}

/**
 * Two-way sensitivity of value per share: rows = WACC values, columns =
 * terminal growth (Gordon) or exit multiple. Invalid cells (WACC ≤ g) are null.
 */
export function dcfSensitivity(i: DcfInputs, waccs: readonly number[], terminalValues: readonly number[]): Array<Array<number | null>> {
  return waccs.map((w) =>
    terminalValues.map((tv) => {
      const terminal: TerminalMethod =
        i.terminal.method === "gordon" ? { method: "gordon", growth: tv } : { method: "exit-multiple", multiple: tv };
      try {
        return runDcf({ ...i, wacc: w, terminal }).valuePerShare;
      } catch {
        return null;
      }
    }),
  );
}
