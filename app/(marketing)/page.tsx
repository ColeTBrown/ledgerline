import Link from "next/link";
import { ArrowRight, Check, FileDown, Keyboard, Lock, Radio, ShieldCheck, Sigma } from "lucide-react";
import { brand } from "@/config/brand";
import { ROLE_IDS, ROLES } from "@/config/roles";
import { TOOLS } from "@/tools/registry";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { DemoForm } from "@/components/marketing/demo-form";
import { ProductPreview } from "@/components/marketing/product-preview";

const FEATURES = [
  {
    icon: Radio,
    title: "Live data with provenance",
    body: "Every pre-filled number carries its source and timestamp. Override any input; the badge flips to Manual and you can reset to live in one click.",
  },
  {
    icon: Sigma,
    title: "Auditable math",
    body: "A pure, fully tested calculation library verified against textbook and spreadsheet results. Calculations run in the browser, instantly.",
  },
  {
    icon: FileDown,
    title: "Desk-ready exports",
    body: "Send any result table to the built-in spreadsheet, or export to Excel, CSV and PDF with disclaimers attached.",
  },
  {
    icon: Keyboard,
    title: "Keyboard first",
    body: "Command palette, role switching and panel shortcuts. Dense layouts that respect the way professionals work.",
  },
  {
    icon: Lock,
    title: "Keys stay server-side",
    body: "Market data flows through thin server routes with caching and rate limiting. Credentials never reach the browser.",
  },
  {
    icon: ShieldCheck,
    title: "Degrades gracefully",
    body: "If a provider is down, tools keep working on manual inputs. No blank screens, and never sample data presented as real.",
  },
];

const TIERS = [
  {
    name: "Professional",
    price: "Contact us",
    blurb: "For individual analysts and advisors.",
    features: ["All five role workspaces", "Saved scenarios", "Excel, CSV and PDF export", "Standard market data"],
  },
  {
    name: "Team",
    price: "Contact us",
    blurb: "For desks and advisory teams.",
    features: ["Everything in Professional", "Shared scenarios and templates", "Firm branding on client reports", "Priority support"],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    blurb: "For firms with compliance and data requirements.",
    features: ["SSO and audit logging", "Bring-your-own data licenses", "Private deployment options", "Dedicated success manager"],
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link href="/" aria-label={`${brand.name} home`}>
            <Logo />
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
            <a href="#roles" className="hover:text-foreground">Workspaces</a>
            <a href="#features" className="hover:text-foreground">Platform</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <a href="#demo" className="hover:text-foreground">Contact</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <a href="#demo">Request demo</a>
            </Button>
            <Button size="sm" asChild>
              <Link href="/app">
                Open workstation <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="bg-grid border-b border-border">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-[1fr_1.15fr] lg:py-24">
            <div>
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-3 py-1 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-accent" aria-hidden />
                Valuation · Wealth · Derivatives · Rates · FP&A
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-balance lg:text-5xl">
                One workstation for every seat on the desk.
              </h1>
              <p className="mt-4 max-w-lg text-base text-pretty text-muted-foreground">{brand.description}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" asChild>
                  <Link href="/app">
                    Launch the workstation <ArrowRight />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <a href="#demo">Book a demo</a>
                </Button>
              </div>
              <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-border pt-6">
                {[
                  [String(ROLE_IDS.length), "Role workspaces"],
                  [String(TOOLS.length), "Professional tools"],
                  ["0", "Calculate buttons"],
                ].map(([k, v]) => (
                  <div key={v}>
                    <dt className="sr-only">{v}</dt>
                    <dd className="num text-2xl font-medium">{k}</dd>
                    <dd className="text-xs text-muted-foreground">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <ProductPreview />
          </div>
        </section>

        <section id="roles" className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <SectionIntro
              eyebrow="Role-based workspaces"
              title="Switch roles, and the whole workstation follows."
              body="Sidebar tools, dashboard and terminology adapt to the seat you are in. Shared tools stay one keystroke away."
            />
            <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
              {ROLE_IDS.map((id) => {
                const role = ROLES[id];
                const tools = TOOLS.filter((t) => t.roles.includes(id));
                return (
                  <div key={id} className="bg-surface p-5">
                    <div className="text-2xs tracking-wider text-accent uppercase">{role.terminology.dashboardTitle}</div>
                    <h3 className="mt-1 text-base font-semibold">{role.label}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{role.description}</p>
                    <ul className="mt-4 space-y-1.5">
                      {tools.map((t) => (
                        <li key={t.id} className="flex items-center gap-2 text-sm">
                          <t.icon className="size-3.5 text-subtle-foreground" aria-hidden />
                          {t.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              <div className="bg-surface p-5">
                <div className="text-2xs tracking-wider text-accent uppercase">Every seat</div>
                <h3 className="mt-1 text-base font-semibold">Shared workspace</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Time value of money, a formula-capable spreadsheet, saved scenarios and company snapshots.
                </p>
                <ul className="mt-4 space-y-1.5">
                  {TOOLS.filter((t) => t.roles.length === 0).map((t) => (
                    <li key={t.id} className="flex items-center gap-2 text-sm">
                      <t.icon className="size-3.5 text-subtle-foreground" aria-hidden />
                      {t.name}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="border-b border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <SectionIntro
              eyebrow="Platform"
              title="Built to the standard of the trading floor."
              body="Precision, provenance and speed, with nothing decorative."
            />
            <div className="mt-10 grid gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title}>
                  <f.icon className="size-5 text-accent" aria-hidden />
                  <h3 className="mt-3 text-sm font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="screenshots" className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <SectionIntro eyebrow="Product tour" title="See it in context." body="Screenshots from each workspace." />
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {["Valuation desk", "Client planning", "Derivatives payoff"].map((label) => (
                <figure key={label} className="overflow-hidden rounded-lg border border-border bg-surface">
                  <div className="bg-grid flex aspect-[16/10] items-center justify-center border-b border-border text-xs text-subtle-foreground">
                    Screenshot coming soon
                  </div>
                  <figcaption className="px-3 py-2 text-xs text-muted-foreground">{label}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="border-b border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <SectionIntro
              eyebrow="Pricing"
              title="Seats that scale with your firm."
              body="Pricing is being finalized. Talk to us about early-access terms."
            />
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {TIERS.map((tier) => (
                <div
                  key={tier.name}
                  className={`flex flex-col rounded-lg border bg-background p-6 ${tier.featured ? "border-accent/60 ring-1 ring-accent/30" : "border-border"}`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{tier.name}</h3>
                    {tier.featured && <span className="text-2xs tracking-wider text-accent uppercase">Most popular</span>}
                  </div>
                  <div className="mt-3 text-2xl font-semibold">{tier.price}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{tier.blurb}</p>
                  <ul className="mt-6 flex-1 space-y-2">
                    {tier.features.map((f) => (
                      <li key={f} className="flex gap-2 text-sm">
                        <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button className="mt-6" variant={tier.featured ? "default" : "outline"} asChild>
                    <a href="#demo">Talk to sales</a>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="demo">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 lg:grid-cols-[1fr_1.3fr]">
            <SectionIntro
              eyebrow="Contact"
              title="See it with your own models."
              body={`Tell us about your team and we'll set up a walkthrough. Or write to ${brand.contactEmail}.`}
            />
            <DemoForm />
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-xs text-muted-foreground md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <Logo />
            <p>
              © {new Date().getFullYear()} {brand.company}
            </p>
          </div>
          <p className="max-w-md text-subtle-foreground">{brand.disclaimer}</p>
        </div>
      </footer>
    </div>
  );
}

function SectionIntro({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="max-w-2xl">
      <div className="text-2xs font-medium tracking-wider text-accent uppercase">{eyebrow}</div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-balance lg:text-3xl">{title}</h2>
      <p className="mt-3 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
