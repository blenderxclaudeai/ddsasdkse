import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Leaf, DollarSign, Clock, Recycle } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  suffix,
  prefix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  prefix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {prefix}
          {value.toLocaleString()}
          {suffix}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

function ResultCard({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ElementType;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-background">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xl font-bold tracking-tight font-display">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Business Calculator                                                */
/* ------------------------------------------------------------------ */

function BusinessTab() {
  const [orders, setOrders] = useState(5000);
  const [returnRate, setReturnRate] = useState(30);
  const [aov, setAov] = useState(80);
  const [shippingCost, setShippingCost] = useState(12);

  const results = useMemo(() => {
    const returnsPerMonth = orders * (returnRate / 100);
    const avoided = returnsPerMonth * 0.3; // 30% reduction from VTO
    const moneySaved = avoided * shippingCost * 12;
    const co2Saved = avoided * 5 * 12; // 5kg per return
    const wastePrevented = avoided * 0.8 * 12; // ~0.8 kg per item
    return { avoided, moneySaved, co2Saved, wastePrevented };
  }, [orders, returnRate, aov, shippingCost]);

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
      <div className="space-y-6">
        <SliderRow label="Monthly orders" value={orders} min={100} max={100000} step={100} onChange={setOrders} />
        <SliderRow label="Return rate" value={returnRate} min={5} max={60} step={1} suffix="%" onChange={setReturnRate} />
        <SliderRow label="Average order value" value={aov} min={20} max={500} step={5} prefix="$" onChange={setAov} />
        <SliderRow label="Average return shipping cost" value={shippingCost} min={5} max={30} step={1} prefix="$" onChange={setShippingCost} />
      </div>
      <div className="grid grid-cols-2 gap-3 content-start">
        <ResultCard icon={Recycle} value={fmt(Math.round(results.avoided))} label="Returns avoided / month" />
        <ResultCard icon={DollarSign} value={`$${fmt(Math.round(results.moneySaved))}`} label="Shipping costs saved / year" />
        <ResultCard icon={Leaf} value={`${fmt(Math.round(results.co2Saved))} kg`} label="CO₂ prevented / year" />
        <ResultCard icon={Recycle} value={`${fmt(Math.round(results.wastePrevented))} kg`} label="Landfill waste prevented / year" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shopper Calculator                                                 */
/* ------------------------------------------------------------------ */

function ShopperTab() {
  const [orders, setOrders] = useState(8);
  const [returnRate, setReturnRate] = useState(30);
  const [avgPrice, setAvgPrice] = useState(60);

  const results = useMemo(() => {
    const returnsPerMonth = orders * (returnRate / 100);
    const avoided = returnsPerMonth * 0.3;
    const moneySaved = avoided * 8 * 12; // ~$8 avg return shipping
    const hoursSaved = (avoided * 30 * 12) / 60; // 30 min per return
    const co2Saved = avoided * 5 * 12;
    return { avoided, moneySaved, hoursSaved, co2Saved };
  }, [orders, returnRate, avgPrice]);

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
      <div className="space-y-6">
        <SliderRow label="Online orders per month" value={orders} min={1} max={50} step={1} onChange={setOrders} />
        <SliderRow label="Items you typically return" value={returnRate} min={0} max={80} step={1} suffix="%" onChange={setReturnRate} />
        <SliderRow label="Average item price" value={avgPrice} min={10} max={300} step={5} prefix="$" onChange={setAvgPrice} />
      </div>
      <div className="grid grid-cols-2 gap-3 content-start">
        <ResultCard icon={Recycle} value={fmt(Math.round(results.avoided * 10) / 10)} label="Returns you'd avoid / month" />
        <ResultCard icon={DollarSign} value={`$${fmt(Math.round(results.moneySaved))}`} label="Saved on return shipping / year" />
        <ResultCard icon={Clock} value={`${fmt(Math.round(results.hoursSaved))} hrs`} label="Time saved / year" />
        <ResultCard icon={Leaf} value={`${fmt(Math.round(results.co2Saved))} kg`} label="CO₂ you'd prevent / year" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Export                                                        */
/* ------------------------------------------------------------------ */

export default function ImpactCalculator() {
  return (
    <section className="border-t py-20">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl font-display">
          Calculate your impact
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-sm text-muted-foreground">
          See how much you could save — for your business, your wallet, and the planet.
        </p>

        <Tabs defaultValue="business" className="mt-10">
          <TabsList className="mx-auto flex w-fit">
            <TabsTrigger value="business">Business</TabsTrigger>
            <TabsTrigger value="shopper">Shopper</TabsTrigger>
          </TabsList>

          <TabsContent value="business" className="mt-8">
            <BusinessTab />
          </TabsContent>
          <TabsContent value="shopper" className="mt-8">
            <ShopperTab />
          </TabsContent>
        </Tabs>

        {/* Condensed "did you know" stats */}
        <div className="mt-16 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { stat: "5 kg", label: "CO₂ per return avoided" },
            { stat: "$816B", label: "Lost to returns yearly" },
            { stat: "9.5B lbs", label: "Landfill from returns" },
            { stat: "60%", label: "Faster decisions" },
            { stat: "3×", label: "More confidence" },
          ].map((s, i) => (
            <div key={i} className="rounded-lg border p-3 text-center">
              <p className="text-lg font-bold tracking-tight font-display">{s.stat}</p>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
