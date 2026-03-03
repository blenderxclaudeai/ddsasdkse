import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Chrome,
  Sparkles,
  Globe,
  Camera,
  Heart,
  ShieldCheck,
  Zap,
  Star,
  ArrowRight,
  MousePointerClick,
  ScanEye,
  ShoppingBag,
} from "lucide-react";
import { Link } from "react-router-dom";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const steps = [
  {
    icon: ShoppingBag,
    title: "Browse any store",
    description:
      "Shop as you normally would on any online retailer. VTO works everywhere.",
  },
  {
    icon: MousePointerClick,
    title: "Click Try On",
    description:
      "See a product you like? Hit the VTO button that appears on the page.",
  },
  {
    icon: ScanEye,
    title: "See it on you",
    description:
      "Our AI generates a realistic image of you wearing or using the product.",
  },
];

const features = [
  {
    icon: Sparkles,
    title: "AI-Powered",
    description:
      "State-of-the-art generative AI creates photorealistic try-on results in seconds.",
  },
  {
    icon: Globe,
    title: "Works on any store",
    description:
      "No integrations needed. VTO detects products on virtually any e-commerce site.",
  },
  {
    icon: Camera,
    title: "Your photos, your style",
    description:
      "Upload photos of yourself once and reuse them across every try-on session.",
  },
  {
    icon: Heart,
    title: "Save to Showroom",
    description:
      "Keep a personal gallery of your favourite try-ons to compare and decide later.",
  },
  {
    icon: ShieldCheck,
    title: "Privacy first",
    description:
      "Your photos are encrypted and never shared. Delete them anytime.",
  },
  {
    icon: Zap,
    title: "Lightning fast",
    description:
      "Results in under 15 seconds so you can keep browsing without interruption.",
  },
];

const reviews = [
  {
    name: "Sarah M.",
    initials: "SM",
    rating: 5,
    text: "I used to return 60% of what I ordered. Since installing VTO, my return rate dropped to almost zero. Game changer.",
  },
  {
    name: "James L.",
    initials: "JL",
    rating: 5,
    text: "Finally I can see how a jacket actually looks on me before buying. The AI is impressively accurate.",
  },
  {
    name: "Priya K.",
    initials: "PK",
    rating: 4,
    text: "Works on Zara, H&M, ASOS — basically every store I shop at. Super convenient.",
  },
  {
    name: "Tom R.",
    initials: "TR",
    rating: 5,
    text: "The showroom feature is brilliant. I save all my try-ons and compare them side by side before checkout.",
  },
  {
    name: "Aisha D.",
    initials: "AD",
    rating: 5,
    text: "I was sceptical about AI try-on but VTO genuinely looks realistic. Shared it with all my friends.",
  },
  {
    name: "Marcus W.",
    initials: "MW",
    rating: 4,
    text: "Great extension. Wish it worked on mobile too, but for desktop shopping it is perfect.",
  },
];

const faqs = [
  {
    q: "How does VTO work?",
    a: "VTO uses generative AI to combine a photo of you with a product image from any online store, producing a realistic visualisation of you wearing or using the item.",
  },
  {
    q: "Which stores are supported?",
    a: "VTO works on virtually any e-commerce website. It automatically detects product images so there is no store-specific setup required.",
  },
  {
    q: "Is my data safe?",
    a: "Yes. Your photos are encrypted in transit and at rest. They are never shared with third parties and you can delete them at any time from your profile.",
  },
  {
    q: "Is VTO free?",
    a: "VTO is free to get started. You get a generous number of monthly try-ons at no cost. Premium plans will be available in the future for power users.",
  },
  {
    q: "What kind of products can I try on?",
    a: "Clothing, accessories, jewellery, glasses, shoes — almost anything wearable. We are also expanding to home decor and furniture.",
  },
  {
    q: "How do I install the extension?",
    a: "Click the download button on this page to go to the Chrome Web Store, then click 'Add to Chrome'. That is it — no other setup needed.",
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i < count
              ? "fill-foreground text-foreground"
              : "text-muted-foreground/40"
          }`}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* ---- Nav ---- */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <span className="text-lg font-semibold tracking-tight font-display">
            VTO
          </span>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <a
              href="https://chrome.google.com/webstore"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" className="gap-1.5">
                <Chrome className="h-3.5 w-3.5" />
                Get extension
              </Button>
            </a>
          </div>
        </div>
      </nav>

      {/* ---- Hero ---- */}
      <section className="mx-auto max-w-5xl px-6 pb-24 pt-20 text-center">
        <h1 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl font-display">
          Try before you buy — on&nbsp;any&nbsp;store
        </h1>
        <p className="mx-auto mt-5 max-w-lg text-base text-muted-foreground sm:text-lg">
          VTO is a free Chrome extension that lets you virtually try on clothes,
          accessories, and more using AI. See how products look on you in
          seconds.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <a
            href="https://chrome.google.com/webstore"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="lg" className="gap-2">
              <Chrome className="h-4 w-4" />
              Download for Chrome
            </Button>
          </a>
          <a href="#how-it-works">
            <Button variant="outline" size="lg" className="gap-2">
              How it works
              <ArrowRight className="h-4 w-4" />
            </Button>
          </a>
        </div>

        {/* Mock browser frame */}
        <div className="mx-auto mt-14 max-w-2xl overflow-hidden rounded-xl border shadow-lg">
          <div className="flex h-8 items-center gap-1.5 border-b bg-muted/60 px-3">
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
          </div>
          <div className="flex h-72 items-center justify-center bg-muted/30 sm:h-80">
            <p className="text-sm text-muted-foreground">
              Extension screenshot placeholder
            </p>
          </div>
        </div>
      </section>

      {/* ---- How it works ---- */}
      <section
        id="how-it-works"
        className="border-t bg-muted/30 py-20"
      >
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl font-display">
            How it works
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {steps.map((s, i) => (
              <div key={i} className="flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border bg-background">
                  <s.icon className="h-5 w-5" />
                </div>
                <span className="mt-1 text-xs text-muted-foreground">
                  Step {i + 1}
                </span>
                <h3 className="mt-2 text-base font-medium">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {s.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Features ---- */}
      <section className="border-t py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl font-display">
            Everything you need
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <Card key={i} className="border bg-background">
                <CardContent className="p-5">
                  <f.icon className="h-5 w-5 text-foreground" />
                  <h3 className="mt-3 text-sm font-medium">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {f.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Reviews ---- */}
      <section className="border-t bg-muted/30 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl font-display">
            What people are saying
          </h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r, i) => (
              <Card key={i} className="border bg-background">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {r.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{r.name}</p>
                      <Stars count={r.rating} />
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    "{r.text}"
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Pricing ---- */}
      <section className="border-t py-20">
        <div className="mx-auto max-w-md px-6 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl font-display">
            Free to get started
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            No credit card required. Install the extension and start trying on
            products today.
          </p>
          <Card className="mt-8 border">
            <CardContent className="p-6">
              <p className="text-3xl font-bold">$0</p>
              <p className="mt-1 text-sm text-muted-foreground">per month</p>
              <ul className="mt-5 space-y-2 text-left text-sm">
                {[
                  "Generous monthly try-on quota",
                  "Works on all stores",
                  "Save to your Showroom",
                  "Multiple profile photos",
                  "Cashback on qualifying purchases",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href="https://chrome.google.com/webstore"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 block"
              >
                <Button className="w-full gap-2">
                  <Chrome className="h-4 w-4" />
                  Get VTO for free
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ---- FAQ ---- */}
      <section className="border-t bg-muted/30 py-20">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl font-display">
            Frequently asked questions
          </h2>
          <Accordion type="single" collapsible className="mt-10">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-sm text-left">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ---- Footer ---- */}
      <footer className="border-t py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 text-center text-xs text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
          <span className="font-medium text-foreground text-sm font-display">
            VTO
          </span>
          <div className="flex gap-4">
            <Link to="/login" className="hover:text-foreground transition-colors">
              Sign in
            </Link>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">
              How it works
            </a>
            <a
              href="https://chrome.google.com/webstore"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Chrome Web Store
            </a>
          </div>
          <span>&copy; {new Date().getFullYear()} VTO. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
