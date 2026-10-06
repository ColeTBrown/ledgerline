import { LogoMark } from "@/components/brand/logo";

/**
 * Static, illustrative mock of the workstation for the landing page.
 * All figures are sample values and are labeled as such.
 */
const SENSITIVITY = {
  growth: ["2.0%", "2.5%", "3.0%", "3.5%"],
  rows: [
    { wacc: "7.5%", values: ["142.10", "151.84", "163.27", "176.91"] },
    { wacc: "8.0%", values: ["129.55", "137.40", "146.48", "157.13"] },
    { wacc: "8.5%", values: ["118.92", "125.33", "132.68", "141.18"] },
    { wacc: "9.0%", values: ["109.81", "115.10", "121.11", "127.96"] },
  ],
};

const STRIP = [
  { s: "SPY", v: "512.40", c: "+0.42%", up: true },
  { s: "QQQ", v: "441.18", c: "+0.71%", up: true },
  { s: "DIA", v: "389.02", c: "-0.12%", up: false },
  { s: "IWM", v: "204.66", c: "-0.38%", up: false },
  { s: "US10Y", v: "4.21%", c: "+2bp", up: false },
];

const SIDEBAR = ["DCF Model", "WACC", "Comparable Companies", "LBO Model", "Ratio Analyzer"];

export function ProductPreview() {
  return (
    <div className="dark relative overflow-hidden rounded-lg border border-border-strong bg-background text-foreground shadow-2xl shadow-black/40">
      <div className="flex h-9 items-center gap-3 border-b border-border bg-surface px-3">
        <LogoMark className="size-4" />
        <span className="rounded-sm border border-border-strong px-1.5 py-0.5 text-2xs text-muted-foreground">
          Role · <span className="text-foreground">Analyst</span>
        </span>
        <div className="flex min-w-0 flex-1 gap-4 overflow-hidden">
          {STRIP.map((t) => (
            <span key={t.s} className="flex shrink-0 items-center gap-1.5 text-2xs">
              <span className="font-medium">{t.s}</span>
              <span className="num text-muted-foreground">{t.v}</span>
              <span className={`num ${t.up ? "text-gain" : "text-loss"}`}>{t.c}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="flex">
        <div className="hidden w-40 shrink-0 space-y-0.5 border-r border-border bg-surface p-2 sm:block">
          <div className="px-2 pt-1 pb-1.5 text-[10px] tracking-wider text-subtle-foreground uppercase">Valuation</div>
          {SIDEBAR.map((item, i) => (
            <div
              key={item}
              className={`truncate rounded-sm px-2 py-1 text-2xs ${i === 0 ? "bg-surface-3 text-foreground" : "text-muted-foreground"}`}
            >
              {item}
            </div>
          ))}
        </div>
        <div className="bg-grid min-w-0 flex-1 p-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { k: "Enterprise value", v: "$2.41T" },
              { k: "Implied share price", v: "$146.48" },
              { k: "Upside vs. last", v: "+8.6%" },
            ].map(({ k, v }) => (
              <div key={k} className="rounded-md border border-border bg-surface p-2">
                <div className="truncate text-[10px] text-subtle-foreground uppercase">{k}</div>
                <div className={`num mt-0.5 text-sm ${v.startsWith("+") ? "text-gain" : ""}`}>{v}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-[1.2fr_1fr]">
            <div className="rounded-md border border-border bg-surface p-2">
              <div className="mb-1.5 flex items-center justify-between text-[10px] text-subtle-foreground uppercase">
                <span>Sensitivity · WACC × g</span>
                <span className="num normal-case">$ / share</span>
              </div>
              <table className="num w-full table-fixed text-right text-[10px]">
                <thead>
                  <tr className="text-subtle-foreground">
                    <th className="py-0.5 text-left font-normal">WACC</th>
                    {SENSITIVITY.growth.map((g) => (
                      <th key={g} className="py-0.5 pl-2 font-normal">
                        {g}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SENSITIVITY.rows.map((r, ri) => (
                    <tr key={r.wacc} className="border-t border-border">
                      <td className="py-0.5 text-left text-muted-foreground">{r.wacc}</td>
                      {r.values.map((v, ci) => (
                        <td
                          key={v}
                          className={`py-0.5 pr-1 pl-2 ${ri === 1 && ci === 2 ? "bg-accent-soft text-accent" : ""}`}
                        >
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-md border border-border bg-surface p-2">
              <div className="mb-1.5 text-[10px] text-subtle-foreground uppercase">Free cash flow ($B)</div>
              <svg viewBox="0 0 200 80" className="h-20 w-full" aria-hidden>
                {[52, 58, 63, 70, 76, 81].map((h, i) => (
                  <rect key={i} x={8 + i * 32} y={80 - h} width="20" height={h} className="fill-accent/70" rx="1" />
                ))}
              </svg>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute right-2 bottom-2 rounded-sm border border-border-strong bg-surface/90 px-1.5 py-0.5 text-[10px] text-subtle-foreground">
        Illustrative preview · sample figures
      </div>
    </div>
  );
}
