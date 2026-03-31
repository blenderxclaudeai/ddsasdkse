import { Leaf, PackageX, TrendingDown, Target } from "lucide-react";

const stats = [
  {
    icon: PackageX,
    value: "10B+",
    label: "items returned yearly",
    detail: "Online fashion returns alone generate over 10 billion items sent back globally each year.",
  },
  {
    icon: Leaf,
    value: "24M tons",
    label: "CO₂ from returns",
    detail: "Return shipping and landfill waste produce roughly 24 million metric tons of CO₂ annually.",
  },
  {
    icon: TrendingDown,
    value: "30–40%",
    label: "online return rate",
    detail: "Clothing bought online is returned at 3× the rate of in-store purchases — mostly due to fit and look.",
  },
  {
    icon: Target,
    value: "70%",
    label: "are preventable",
    detail: "Studies show most fashion returns happen because the item didn't look as expected. Virtual try-on solves this.",
  },
];

export default function CartifyMission() {
  return (
    <section className="border-t py-20">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl font-display">
          Why Cartify exists
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted-foreground leading-relaxed">
          Online returns are an environmental and economic crisis. Our goal: capture 10% of the online fashion market
          and eliminate millions of unnecessary returns — saving money, time, and the planet.
        </p>

        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {stats.map((s, i) => (
            <div
              key={i}
              className="group rounded-2xl border bg-background p-6 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                  <s.icon className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight font-display">{s.value}</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{s.label}</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{s.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-2xl border bg-secondary/30 p-8 text-center">
          <p className="text-lg font-semibold tracking-tight font-display">Our 10% goal</p>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground leading-relaxed">
            If Cartify prevents just 10% of fashion returns, that's <strong className="text-foreground">1 billion fewer returned items</strong>,{" "}
            <strong className="text-foreground">2.4 million tons of CO₂ saved</strong>, and{" "}
            <strong className="text-foreground">$38 billion in recovered revenue</strong> for retailers every year.
          </p>
        </div>
      </div>
    </section>
  );
}
