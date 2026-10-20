import { Suspense, type ComponentType } from "react";
import { CompanySnapshot } from "@/components/tools/company/company-snapshot";
import { TvmCalculator } from "@/components/tools/tvm/tvm-calculator";
import { WaccTool } from "@/components/tools/valuation/wacc-tool";
import { DcfTool } from "@/components/tools/valuation/dcf-tool";
import { RatiosTool } from "@/components/tools/valuation/ratios-tool";
import { CompsTool } from "@/components/tools/valuation/comps-tool";
import { LboTool } from "@/components/tools/valuation/lbo-tool";
import { CapitalBudgetingTool } from "@/components/tools/corpfin/capital-budgeting-tool";
import { LoanAmortizationTool } from "@/components/tools/corpfin/loan-amortization-tool";
import { BreakEvenTool } from "@/components/tools/corpfin/break-even-tool";
import { VarianceTool } from "@/components/tools/corpfin/variance-tool";
import { BlackScholesTool } from "@/components/tools/options/black-scholes-tool";
import { ImpliedVolTool } from "@/components/tools/options/implied-vol-tool";
import { BinomialTool } from "@/components/tools/options/binomial-tool";
import { BondPricerTool } from "@/components/tools/fixed-income/bond-pricer-tool";
import { DurationTool } from "@/components/tools/fixed-income/duration-tool";
import { RetirementTool } from "@/components/tools/wealth/retirement-tool";
import { ToolPlaceholder } from "@/components/calc/tool-placeholder";

/** Built tool UIs by registry id. Tools not listed render the placeholder frame. */
const IMPLEMENTATIONS: Record<string, ComponentType> = {
  company: CompanySnapshot,
  tvm: TvmCalculator,
  wacc: WaccTool,
  dcf: DcfTool,
  ratios: RatiosTool,
  comps: CompsTool,
  lbo: LboTool,
  "capital-budgeting": CapitalBudgetingTool,
  "loan-amortization": LoanAmortizationTool,
  "break-even": BreakEvenTool,
  variance: VarianceTool,
  "black-scholes": BlackScholesTool,
  "implied-vol": ImpliedVolTool,
  binomial: BinomialTool,
  "bond-pricer": BondPricerTool,
  duration: DurationTool,
  retirement: RetirementTool,
};

export function isToolBuilt(id: string): boolean {
  return id in IMPLEMENTATIONS;
}

/**
 * Render a tool by id. Wrapped in Suspense because tools may read URL search
 * params (useSearchParams).
 */
export function ToolRenderer({ id }: { id: string }) {
  const Impl = IMPLEMENTATIONS[id];
  if (!Impl) return <ToolPlaceholder toolId={id} />;
  return (
    <Suspense fallback={null}>
      <Impl />
    </Suspense>
  );
}
