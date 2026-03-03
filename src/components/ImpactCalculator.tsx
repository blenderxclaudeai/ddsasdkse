import { useState, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

function SliderRow({
  label, value, min, max, step, suffix, prefix, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  suffix?: string; prefix?: string; onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {prefix}{value.toLocaleString()}{suffix}
        </span>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}

function ResultRow({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-3xl font-bold tracking-tight font-display">{value}</p>
      <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function BusinessTab() {
  const [orders, setOrders] = useState(5000);
  const [returnRate, setReturnRate] = useState(30);
  const [aov, setAov] = useState(80);
  const [shippingCost, setShippingCost] = useState(12);

  const results = useMemo(() => {
    const returnsPerMonth = orders * (returnRate / 100);
    const avoided = returnsPerMonth * 0.3;
    const revenueRecovered = avoided * aov * 12;
    const shippingSaved = avoided * shippingCost * 12;
    const processingSaved = avoided * 10 * 12;
    const co2Saved = avoided * 5 * 12;
    return { avoided, revenueRecovered, shippingSaved, processingSaved, co2Saved };
  }, [orders, returnRate, aov, shippingCost]);

  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
      <div className="space-y-6">
        <SliderRow label="Monthly orders" value={orders} min={100} max={100000} step={100} onChange={setOrders} />
        <SliderRow label="Return rate" value={returnRate} min={5} max={60} step={1} suffix="%" onChange={setReturnRate} />
        <SliderRow label="Average order value" value={aov} min={20} max={500} step={5} prefix="$" onChange={setAov} />
        <SliderRow label="Return shipping cost" value={shippingCost} min={5} max={30} step={1} prefix="$" onChange={setShippingCost} />
      </div>
      <div className="space-y-6 content-start">
        <ResultRow value={fmt(Math.round(results.avoided))} label="Returns avoided / month" />
        <ResultRow value={`$${fmt(Math.round(results.revenueRecovered))}`} label="Revenue recovered / year" />
        <ResultRow value={`$${fmt(Math.round(results.shippingSaved + results.processingSaved))}`} label="Shipping & processing saved / year" />
        <ResultRow value={`${fmt(Math.round(results.co2Saved))} kg`} label="CO₂ prevented / year" />
      </div>
    </div>
  );
}

function ShopperTab() {
  const [orders, setOrders] = useState(8);
  const [returnRate, setReturnRate] = useState(30);
  const [avgPrice, setAvgPrice] = useState(60);

  const results = useMemo(() => {
    const returnsPerMonth = orders * (returnRate / 100);
    const avoided = returnsPerMonth * 0.3;
    const moneyKept = avoided * avgPrice * 12;
    const hoursSaved = (avoided * 30 * 12) / 60;
    const co2Saved = avoided * 5 * 12;
    return { avoided, moneyKept, hoursSaved, co2Saved };
  }, [orders, returnRate, avgPrice]);

  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
      <div className="space-y-6">
        <SliderRow label="Online orders per month" value={orders} min={1} max={50} step={1} onChange={setOrders} />
        <SliderRow label="Items you typically return" value={returnRate} min={0} max={80} step={1} suffix="%" onChange={setReturnRate} />
        <SliderRow label="Average item price" value={avgPrice} min={10} max={300} step={5} prefix="$" onChange={setAvgPrice} />
      </div>
      <div className="space-y-6 content-start">
        <ResultRow value={fmt(Math.round(results.avoided * 10) / 10)} label="Returns you'd avoid / month" />
        <ResultRow value={`$${fmt(Math.round(results.moneyKept))}`} label="Money kept / year" />
        <ResultRow value={`${fmt(Math.round(results.hoursSaved))} hrs`} label="Time saved / year" />
        <ResultRow value={`${fmt(Math.round(results.co2Saved))} kg`} label="CO₂ you'd prevent / year" />
      </div>
    </div>
  );
}

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
      </div>
    </section>
  );
}
