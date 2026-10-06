# lib/finance

Pure, framework-free financial math. No React, no network access and no global state, so every function can be unit-tested and reused on the server, in Web Workers or in exports.

## Conventions

- **Rates are decimals:** `0.05` means 5%.
- **Invalid input throws** `FinanceInputError` (it extends `RangeError`), with a message you can show inline and a `field` name for mapping to a form field.
- **A valid input with no answer returns `null`.** Examples: an IRR when there's no sign change or no root, an implied volatility outside the no-arbitrage bounds, or a payback period that is never reached.
- **Missing data stays missing.** Comps and ratios accept `null` inputs and return `null` (shown as "NM" or "—"). They never substitute 0.
- **Every function's JSDoc states its formula.** The reference values used in tests come from Excel's documentation, Hull, Fabozzi, or independent computation.

## Modules

| Module | Contents |
| --- | --- |
| `tvm.ts` | FV, PV, PMT, NPER, RATE, IPMT, PPMT, EFFECT/NOMINAL, `solveTvm` |
| `cashflow.ts` | NPV (Excel and t=0 conventions), IRR, all IRRs, MIRR, XNPV, XIRR, payback, discounted payback, PI, EAA |
| `loans.ts` | Amortization schedule with recurring and lump-sum extra payments |
| `bonds.ts` | Clean/dirty price, accrued interest, YTM, YTC, current yield, Macaulay/modified duration, convexity, DV01, rate shocks |
| `rates.ts` | Yield-curve interpolation (horizon-matched risk-free rate), tenor parsing, compounding conversion |
| `options/black-scholes.ts` | Black–Scholes–Merton price and Greeks with dividend yield |
| `options/implied-vol.ts` | Newton–Raphson IV with bisection fallback |
| `options/binomial.ts` | CRR tree for American and European options, with tree output for visualization |
| `options/strategies.ts` | Multi-leg payoffs (at expiry and today), breakevens, max profit/loss, Greeks, presets |
| `valuation/wacc.ts` | CAPM, after-tax cost of debt, WACC, Hamada beta |
| `valuation/dcf.ts` | Unlevered DCF (Gordon or exit multiple, mid-year), sensitivity grid |
| `valuation/comps.ts` | Trading multiples, summary statistics, implied valuation |
| `valuation/lbo.ts` | Sources & uses, debt schedule with cash sweep, IRR/MOIC |
| `ratios.ts` | 22 liquidity, leverage, profitability and efficiency ratios |
| `portfolio.ts` | Covariance, return/volatility/Sharpe, long-only efficient frontier, minimum-variance and max-Sharpe portfolios |
| `rebalance.ts` | Trades to target weights (whole or fractional shares) |
| `retirement.ts` | Deterministic accumulation and withdrawal projection, shortfall |
| `montecarlo.ts` | Seeded lognormal Monte Carlo with percentile bands and success probability |
| `breakeven.ts`, `variance.ts`, `stats.ts`, `solvers.ts`, `rng.ts` | Supporting tools |
