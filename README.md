# Ledgerline

A professional-grade financial workstation for analysts, wealth managers, derivatives traders, fixed-income desks and FP&A teams. Dense terminal-style UI, live market data with provenance, and a fully tested client-side calculation library.

> The product name lives in [`config/brand.ts`](config/brand.ts). Change it there to rebrand.

## Status

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Project setup, design system, layout shell, role switcher, command palette, landing page | ✅ |
| 2 | Finance math library + test suite | ✅ |
| 3 | Market data layer (Finnhub, U.S. Treasury, SEC EDGAR), source badges, ticker search, ticker strip | ⏳ |
| 4 | Shared tools: TVM, spreadsheet, scenarios, exports | ⏳ |
| 5 | Analyst + Corporate Finance tools | ⏳ |
| 6 | Wealth Manager tools | ⏳ |
| 7 | Options + Fixed Income tools | ⏳ |
| 8 | Polish, accessibility, docs | ⏳ |

## Features

- **Role-based workspaces**: Equity Analyst, Wealth Manager, Options, Fixed Income and Corporate Finance. Each one changes the sidebar, dashboard and terminology.
- **Command palette** (`⌘K` / `Ctrl+K`): jump to any tool, switch role, or run a command.
- **Dark terminal theme** by default, plus a light client-facing theme.
- **Number formatting**: tabular monospaced figures, locale-aware separators, configurable decimals, negatives shown with a minus sign or in parentheses.
- **Live data provenance** (Phase 3): every sourced number shows a LIVE / DELAYED / CACHED / MANUAL badge with its source and timestamp.

### Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `⌘K` / `Ctrl+K` | Command palette |
| `⌥1`–`⌥5` / `Alt+1`–`Alt+5` | Switch role (browsers reserve `⌘1`–`⌘9` for tab switching) |
| `⌘B` / `Ctrl+B` | Toggle sidebar |
| `⌘.` / `Ctrl+.` | Toggle notes panel |
| `⌘,` / `Ctrl+,` | Settings |

## Tech stack

Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui-style components on Radix · Zustand · TanStack Query · Vitest. Charts (Recharts, lightweight-charts), AG Grid Community and ExcelJS arrive with the phases that use them.

## Getting started

Requirements: Node.js 20.9+ and pnpm 10.

```bash
pnpm install
cp .env.example .env.local   # optional: the app runs fully in manual mode without keys
pnpm dev                     # http://localhost:3000 (landing) and /app (workstation)
```

### Free Finnhub API key

1. Create a free account at <https://finnhub.io/register>.
2. Copy the API key from your dashboard.
3. Set `FINNHUB_API_KEY=...` in `.env.local`.

Also set `SEC_USER_AGENT="Your Firm you@yourfirm.com"`. SEC EDGAR requires a descriptive User-Agent with a contact email. No key is needed for the U.S. Treasury feed.

### Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Generate route types + `tsc --noEmit` |
| `pnpm test` | Vitest (never calls live APIs) |
| `pnpm test:coverage` | Tests with a V8 coverage report |
| `pnpm check` | Lint + typecheck + tests |

## Project structure

```
app/                 Next.js routes: "/" landing, "/app" workstation, "/api/*" server routes
components/          ui/ (primitives), shell/, data/, calc/, dashboard/, marketing/
config/              brand.ts (rename here), roles.ts
tools/registry.ts    Every tool: id, roles, group, icon, keywords
lib/finance/         Pure financial math — see lib/finance/README.md
lib/data/            Market data provider interface + adapters (Phase 3)
lib/format/          Number / currency / percent formatting
lib/store/           Zustand stores (settings persisted to localStorage)
tests/               Vitest suites
```

## Screenshots

_Coming in Phase 8._

## Deploying to Vercel

1. Import the GitHub repository in Vercel. The framework preset is detected automatically.
2. Under **Project → Settings → Environment Variables**, add `FINNHUB_API_KEY` and `SEC_USER_AGENT` (and optionally the `*_PROVIDER` variables) for Production and Preview.
3. Deploy. Market data routes run as serverless functions, so API keys never reach the browser.

## Disclaimer

For informational purposes only. Not investment, tax, or legal advice. Market data provided by third parties and may be delayed.
