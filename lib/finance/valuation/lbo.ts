/**
 * Simplified leveraged buyout model.
 *
 * Entry:  EV = LTM EBITDA × entry multiple
 *         Uses = EV + transaction fees + financing fees + minimum cash
 *         Sources = Σ debt tranches (× EBITDA) + sponsor equity (plug)
 * Annual: interest is charged on beginning-of-year debt (no circularity);
 *         levered FCF = NI + D&A − CapEx − ΔNWC;
 *         mandatory amortization first, then a cash sweep of excess cash
 *         (above the minimum) applied to sweep-eligible tranches in order.
 * Exit:   Equity = EBITDA_N × exit multiple − (debt_N − cash_N)
 *         MOIC = exit equity / sponsor equity, IRR = MOIC^(1/N) − 1
 */
import { FinanceInputError, assertFinite, assertNonNegative, assertPositive, assertPositiveInteger } from "../errors";

export interface DebtTranche {
  name: string;
  /** Size as a multiple of LTM EBITDA. */
  ebitdaMultiple: number;
  /** Annual cash interest rate. */
  rate: number;
  /** Mandatory annual amortization as % of original principal. */
  amortizationPct: number;
  /** Eligible for the excess-cash sweep. */
  sweep: boolean;
}

export interface LboInputs {
  ltmRevenue: number;
  ltmEbitda: number;
  entryMultiple: number;
  exitMultiple: number;
  years: number;
  /** Revenue growth — single rate or one per year. */
  revenueGrowth: number | readonly number[];
  /** EBITDA margin — single value or one per year. */
  ebitdaMargin: number | readonly number[];
  daPctRevenue: number;
  capexPctRevenue: number;
  nwcPctRevenue: number;
  taxRate: number;
  /** % of excess cash applied to debt each year (0–1). */
  cashSweepPct: number;
  minimumCash: number;
  /** Transaction fees as % of entry EV. */
  transactionFeePct: number;
  /** Financing fees as % of total debt raised. */
  financingFeePct: number;
  tranches: readonly DebtTranche[];
}

export interface SourcesAndUses {
  sources: Array<{ label: string; amount: number }>;
  uses: Array<{ label: string; amount: number }>;
  totalSources: number;
  totalUses: number;
  sponsorEquity: number;
  totalDebt: number;
  entryEnterpriseValue: number;
}

export interface LboYear {
  year: number;
  revenue: number;
  ebitda: number;
  da: number;
  ebit: number;
  interest: number;
  taxes: number;
  netIncome: number;
  capex: number;
  changeInNwc: number;
  leveredFcf: number;
  mandatoryRepayment: number;
  sweepRepayment: number;
  /** Ending balance per tranche, in input order. */
  debtBalances: number[];
  totalDebt: number;
  cash: number;
  netDebtToEbitda: number;
  /** True when cash falls below zero (the model has no revolver to fund the gap). */
  cashShortfall: boolean;
}

export interface LboResult {
  sourcesAndUses: SourcesAndUses;
  years: LboYear[];
  exitEnterpriseValue: number;
  exitNetDebt: number;
  exitEquity: number;
  moic: number;
  /** Null when exit equity ≤ 0 (total loss). */
  irr: number | null;
}

function pick(v: number | readonly number[], i: number, field: string): number {
  if (typeof v === "number") return v;
  const x = v[i] ?? v[v.length - 1];
  if (x === undefined) throw new FinanceInputError(`Provide ${field}.`, field);
  return x;
}

export function runLbo(i: LboInputs): LboResult {
  assertPositive(i.ltmRevenue, "ltmRevenue");
  assertPositive(i.ltmEbitda, "ltmEbitda");
  assertPositive(i.entryMultiple, "entryMultiple");
  assertPositive(i.exitMultiple, "exitMultiple");
  assertPositiveInteger(i.years, "years");
  if (i.years > 15) throw new FinanceInputError("Holding period is limited to 15 years.", "years");
  assertNonNegative(i.minimumCash, "minimumCash");
  assertNonNegative(i.transactionFeePct, "transactionFeePct");
  assertNonNegative(i.financingFeePct, "financingFeePct");
  assertFinite(i.taxRate, "taxRate");
  if (i.cashSweepPct < 0 || i.cashSweepPct > 1) throw new FinanceInputError("Cash sweep must be between 0% and 100%.", "cashSweepPct");
  i.tranches.forEach((t, k) => {
    assertNonNegative(t.ebitdaMultiple, `tranches[${k}].ebitdaMultiple`);
    assertNonNegative(t.rate, `tranches[${k}].rate`);
    assertNonNegative(t.amortizationPct, `tranches[${k}].amortizationPct`);
  });

  // ── Sources & uses ────────────────────────────────────────────────────
  const entryEv = i.ltmEbitda * i.entryMultiple;
  const originals = i.tranches.map((t) => t.ebitdaMultiple * i.ltmEbitda);
  const totalDebt = originals.reduce((s, d) => s + d, 0);
  const transactionFees = entryEv * i.transactionFeePct;
  const financingFees = totalDebt * i.financingFeePct;
  const totalUses = entryEv + transactionFees + financingFees + i.minimumCash;
  const sponsorEquity = totalUses - totalDebt;
  if (sponsorEquity <= 0) {
    throw new FinanceInputError("Debt exceeds total uses — reduce leverage so the sponsor contributes equity.", "tranches");
  }
  const sourcesAndUses: SourcesAndUses = {
    sources: [...i.tranches.map((t, k) => ({ label: t.name, amount: originals[k]! })), { label: "Sponsor equity", amount: sponsorEquity }],
    uses: [
      { label: "Purchase enterprise value", amount: entryEv },
      { label: "Transaction fees", amount: transactionFees },
      { label: "Financing fees", amount: financingFees },
      { label: "Cash to balance sheet", amount: i.minimumCash },
    ],
    totalSources: totalDebt + sponsorEquity,
    totalUses,
    sponsorEquity,
    totalDebt,
    entryEnterpriseValue: entryEv,
  };

  // ── Projection ────────────────────────────────────────────────────────
  const balances = [...originals];
  let cash = i.minimumCash;
  let prevRevenue = i.ltmRevenue;
  const years: LboYear[] = [];
  for (let k = 0; k < i.years; k++) {
    const revenue = prevRevenue * (1 + pick(i.revenueGrowth, k, "revenueGrowth"));
    const ebitda = revenue * pick(i.ebitdaMargin, k, "ebitdaMargin");
    const da = revenue * i.daPctRevenue;
    const ebit = ebitda - da;
    const interest = i.tranches.reduce((s, t, j) => s + balances[j]! * t.rate, 0);
    const ebt = ebit - interest;
    const taxes = Math.max(ebt, 0) * i.taxRate;
    const netIncome = ebt - taxes;
    const capex = revenue * i.capexPctRevenue;
    const changeInNwc = i.nwcPctRevenue * (revenue - prevRevenue);
    const leveredFcf = netIncome + da - capex - changeInNwc;

    cash += leveredFcf;
    // Mandatory amortization, limited by balance outstanding.
    let mandatoryRepayment = 0;
    i.tranches.forEach((t, j) => {
      const due = Math.min(balances[j]!, originals[j]! * t.amortizationPct);
      balances[j] = balances[j]! - due;
      mandatoryRepayment += due;
    });
    cash -= mandatoryRepayment;

    // Optional cash sweep on excess cash.
    let sweepRepayment = 0;
    let available = Math.max(0, cash - i.minimumCash) * i.cashSweepPct;
    for (let j = 0; j < i.tranches.length && available > 0; j++) {
      if (!i.tranches[j]!.sweep) continue;
      const pay = Math.min(available, balances[j]!);
      balances[j] = balances[j]! - pay;
      available -= pay;
      sweepRepayment += pay;
    }
    cash -= sweepRepayment;

    const debtNow = balances.reduce((s, b) => s + b, 0);
    years.push({
      year: k + 1,
      revenue,
      ebitda,
      da,
      ebit,
      interest,
      taxes,
      netIncome,
      capex,
      changeInNwc,
      leveredFcf,
      mandatoryRepayment,
      sweepRepayment,
      debtBalances: [...balances],
      totalDebt: debtNow,
      cash,
      netDebtToEbitda: ebitda !== 0 ? (debtNow - cash) / ebitda : Number.NaN,
      cashShortfall: cash < 0,
    });
    prevRevenue = revenue;
  }

  const last = years[years.length - 1]!;
  const exitEnterpriseValue = last.ebitda * i.exitMultiple;
  const exitNetDebt = last.totalDebt - last.cash;
  const exitEquity = exitEnterpriseValue - exitNetDebt;
  const moic = exitEquity / sponsorEquity;
  return {
    sourcesAndUses,
    years,
    exitEnterpriseValue,
    exitNetDebt,
    exitEquity,
    moic,
    irr: moic > 0 ? Math.pow(moic, 1 / i.years) - 1 : null,
  };
}
