import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain } = await req.json();
    if (!domain || typeof domain !== "string") {
      return new Response(JSON.stringify({ error: "Missing domain" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const cleanDomain = domain.replace(/^www\./, "");

    // Check for cached coupons in DB
    const { data: cached } = await supabase
      .from("retailer_coupons")
      .select("code,description,discount_type,discount_value,min_purchase,scraped_at")
      .eq("domain", cleanDomain)
      .eq("is_active", true);

    const manualCoupons = (cached || []).filter((c: any) => !c.scraped_at);
    const scrapedCoupons = (cached || []).filter((c: any) => c.scraped_at);
    const hasFreshScraped = scrapedCoupons.some(
      (c: any) => Date.now() - new Date(c.scraped_at).getTime() < CACHE_TTL_MS
    );

    // If we have fresh scraped data, return them without scraping
    if (hasFreshScraped) {
      const all = [...manualCoupons, ...scrapedCoupons];
      return new Response(
        JSON.stringify({ coupons: all.map(({ scraped_at, ...rest }: any) => rest) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Tier 1: Firecrawl search (reliable, handles anti-bot) ──
    let discoveredCoupons: any[] = [];
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (firecrawlKey) {
      try {
        const year = new Date().getFullYear();
        const searchQuery = `${cleanDomain} coupon code ${year}`;
        console.log(`[scrape-coupons] Firecrawl search: "${searchQuery}"`);

        const fcRes = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: searchQuery,
            limit: 5,
            scrapeOptions: { formats: ["markdown"] },
          }),
        });

        if (fcRes.ok) {
          const fcData = await fcRes.json();
          const results = fcData?.data || [];
          // Combine all markdown content from search results
          let combinedText = "";
          for (const r of results) {
            combinedText += " " + (r.markdown || r.description || "");
          }
          discoveredCoupons = extractCouponsFromText(combinedText, cleanDomain);
          console.log(`[scrape-coupons] Firecrawl found ${discoveredCoupons.length} codes for ${cleanDomain}`);
        } else {
          const errText = await fcRes.text();
          console.error(`[scrape-coupons] Firecrawl failed [${fcRes.status}]:`, errText);
        }
      } catch (e) {
        console.error("[scrape-coupons] Firecrawl error:", e);
      }
    }

    // ── Tier 2: AI fallback (only if Firecrawl found nothing) ──
    if (discoveredCoupons.length === 0) {
      const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
      if (lovableApiKey) {
        try {
          const today = new Date().toISOString().split("T")[0];
          const aiPrompt = `List currently active and valid coupon codes and promotional discount codes for the online retailer "${cleanDomain}" as of ${today}.

Return ONLY a valid JSON array. Each object must have:
- "code": the coupon/promo code string (must be an actual code customers can enter at checkout)
- "description": short description of the deal
- "discount_type": "percentage" or "fixed" or "free_shipping" or "other"
- "discount_value": the discount amount as string (e.g. "20%" or "$10") or null

Rules:
- Only include codes that are likely still active and working
- Include well-known recurring codes (e.g. newsletter signup discounts, student discounts, seasonal codes)
- Do NOT make up fictional codes — only include codes you have high confidence in
- If you don't know any valid codes for this retailer, return an empty array []
- Maximum 15 codes`;

          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: "You are a coupon code expert. Return only valid JSON arrays of coupon codes. Be honest — if you don't know any codes, return an empty array." },
                { role: "user", content: aiPrompt },
              ],
              response_format: { type: "json_object" },
            }),
          });

          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const content = aiData?.choices?.[0]?.message?.content || "[]";
            let parsed: any;
            try {
              parsed = JSON.parse(content);
            } catch {
              const match = content.match(/\[[\s\S]*\]/);
              parsed = match ? JSON.parse(match[0]) : [];
            }
            const aiCodes: any[] = Array.isArray(parsed)
              ? parsed
              : Array.isArray(parsed?.coupons) ? parsed.coupons : [];
            discoveredCoupons = aiCodes
              .map((c: any) => ({
                code: String(c.code || "").trim().slice(0, 50),
                description: String(c.description || "").slice(0, 200),
                discount_type: c.discount_type || "other",
                discount_value: c.discount_value ? String(c.discount_value).slice(0, 50) : null,
              }))
              .filter((c: any) => isValidCouponCode(c.code));
          } else {
            console.error("[scrape-coupons] AI request failed:", aiRes.status);
          }
        } catch (e) {
          console.error("[scrape-coupons] AI fallback error:", e);
        }
      }
    }

    // If we found coupons, persist them
    if (discoveredCoupons.length > 0) {
      // Delete old scraped coupons for this domain
      await supabase
        .from("retailer_coupons")
        .delete()
        .eq("domain", cleanDomain)
        .not("scraped_at", "is", null);

      const now = new Date().toISOString();
      const expires = new Date(Date.now() + CACHE_TTL_MS).toISOString();
      const rows = discoveredCoupons.slice(0, 15).map((c: any) => ({
        domain: cleanDomain,
        code: String(c.code || "").slice(0, 50),
        description: String(c.description || "").slice(0, 200),
        discount_type: c.discount_type || "other",
        discount_value: c.discount_value ? String(c.discount_value).slice(0, 50) : null,
        is_active: true,
        scraped_at: now,
        expires_at: expires,
      }));

      const { error: insertError } = await supabase
        .from("retailer_coupons")
        .insert(rows);
      if (insertError) console.error("Insert error:", insertError);

      const results = rows.map(({ scraped_at, expires_at, is_active, ...rest }) => rest);
      const manualResults = manualCoupons.map(({ scraped_at, ...rest }: any) => rest);
      return new Response(JSON.stringify({ coupons: [...manualResults, ...results] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Nothing found — return whatever DB coupons we have (manual + stale scraped)
    const fallback = (cached || []).map(({ scraped_at, ...rest }: any) => rest);
    return new Response(JSON.stringify({ coupons: fallback }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("scrape-coupons error:", err);
    return new Response(JSON.stringify({ error: "Internal error", coupons: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Massive blocklist of common words that appear in search snippets ──

const BLOCKLIST = new Set([
  // English common words
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "her", "was", "one",
  "our", "out", "day", "get", "has", "him", "his", "how", "its", "may", "new", "now", "old",
  "see", "way", "who", "did", "got", "let", "say", "she", "too", "use", "try", "buy", "top",
  "off", "per", "set", "run", "hot", "big", "add", "end", "why", "own", "put", "red", "key",
  "any", "few", "ago", "far", "lot", "yet", "due", "act", "age", "air", "art", "ask", "bad",
  "bar", "bed", "bit", "box", "bus", "car", "cut", "dog", "ear", "eat", "eye", "fit", "fun",
  "gas", "gun", "guy", "hat", "hit", "ice", "job", "kid", "law", "lay", "leg", "lie", "lip",
  "map", "mix", "net", "nor", "oil", "pay", "pie", "pop", "pot", "raw", "row", "sea", "sit",
  "six", "ski", "sky", "son", "sun", "tea", "ten", "tie", "tip", "toe", "war", "win", "yes",
  "code", "find", "first", "page", "free", "best", "deal", "sale", "save", "shop", "site",
  "home", "more", "than", "just", "been", "will", "with", "this", "that", "from", "your",
  "have", "each", "make", "like", "long", "look", "many", "some", "them", "then", "what",
  "when", "come", "here", "much", "take", "year", "most", "good", "give", "also", "back",
  "work", "only", "well", "call", "used", "over", "last", "need", "keep", "help", "show",
  "turn", "move", "live", "play", "feel", "tell", "does", "done", "made", "went", "came",
  "left", "hand", "high", "line", "list", "link", "city", "data", "date", "down", "even",
  "fact", "full", "goes", "half", "head", "idea", "kind", "knew", "late", "lead", "less",
  "life", "lost", "main", "mark", "name", "near", "next", "note", "open", "part", "past",
  "plan", "read", "real", "rest", "rule", "same", "seem", "side", "sign", "size", "step",
  "sure", "talk", "team", "test", "text", "time", "true", "type", "unit", "upon", "view",
  "wait", "walk", "want", "week", "went", "wide", "word", "zero", "area", "away", "body",
  "book", "both", "case", "cost", "door", "draw", "drop", "else", "face", "fall", "fill",
  "fine", "food", "foot", "form", "four", "game", "girl", "grow", "hold", "hope", "hour",
  "huge", "join", "jump", "king", "land", "leave", "load", "lock", "mean", "mind", "miss",
  "mine", "mode", "must", "nice", "none", "once", "pair", "pick", "pull", "push", "race",
  "rain", "rate", "rich", "ride", "ring", "rise", "risk", "road", "rock", "role", "room",
  "safe", "said", "seat", "sell", "send", "ship", "sing", "skin", "soft", "soil", "sort",
  "star", "stay", "stop", "such", "suit", "swim", "tail", "term", "thin", "till", "took",
  "tool", "tree", "trip", "upon", "user", "vary", "very", "vote", "wake", "wall", "warm",
  "wash", "wear", "west", "whom", "wild", "wind", "wine", "wire", "wish", "wood", "wore",
  "wrap", "yard",
  // 5-letter common words
  "about", "above", "after", "again", "along", "apply", "basic", "being", "below", "black",
  "board", "brand", "break", "bring", "brown", "build", "carry", "catch", "cause", "chain",
  "check", "child", "class", "clean", "clear", "click", "close", "could", "count", "cover",
  "cross", "daily", "debug", "drink", "drive", "early", "eight", "email", "empty", "enjoy",
  "enter", "equal", "error", "event", "every", "exact", "exist", "extra", "faith", "field",
  "fight", "final", "first", "fixed", "flash", "floor", "focus", "force", "found", "fresh",
  "front", "fully", "given", "glass", "going", "grade", "grand", "grant", "grass", "great",
  "green", "gross", "group", "grown", "guess", "happy", "heart", "heavy", "hello", "horse",
  "hotel", "house", "human", "ideal", "image", "index", "inner", "input", "issue", "items",
  "joint", "judge", "juice", "known", "label", "large", "later", "laugh", "layer", "learn",
  "legal", "level", "light", "limit", "local", "login", "lower", "lucky", "lunch", "magic",
  "major", "match", "maybe", "media", "metal", "might", "minor", "model", "money", "month",
  "moral", "motor", "mount", "mouse", "mouth", "music", "never", "night", "noise", "north",
  "noted", "novel", "offer", "often", "order", "other", "outer", "owner", "paint", "panel",
  "paper", "party", "patch", "peace", "phone", "photo", "piano", "piece", "pilot", "pitch",
  "place", "plain", "plant", "plate", "plaza", "point", "pound", "power", "press", "price",
  "pride", "prime", "print", "prior", "prize", "proof", "proud", "prove", "queen", "query",
  "quest", "quick", "quiet", "quite", "quote", "radio", "raise", "range", "rapid", "reach",
  "ready", "refer", "reign", "relax", "reply", "right", "rival", "river", "robot", "roger",
  "roman", "rough", "round", "route", "royal", "rural", "sadly", "salad", "sauce", "scale",
  "scene", "scope", "score", "sense", "serve", "seven", "shall", "shape", "share", "sharp",
  "sheet", "shell", "shift", "shirt", "shock", "shoot", "short", "since", "sixth", "sixty",
  "sleep", "slide", "small", "smart", "smell", "smile", "smoke", "solid", "solve", "sorry",
  "sound", "south", "space", "spare", "speak", "speed", "spend", "split", "sport", "spray",
  "stack", "staff", "stage", "stake", "stand", "start", "state", "steam", "steel", "steep",
  "stick", "still", "stock", "stone", "store", "storm", "story", "strip", "stuck", "study",
  "stuff", "style", "sugar", "suite", "super", "sweet", "swing", "table", "taken", "taste",
  "teach", "teeth", "thank", "theme", "there", "these", "thick", "thing", "think", "third",
  "those", "three", "throw", "tight", "title", "today", "token", "total", "touch", "tough",
  "tower", "track", "trade", "train", "treat", "trend", "trial", "trick", "truck", "truly",
  "trust", "twice", "under", "union", "unite", "unity", "until", "upper", "upset", "urban",
  "usage", "usual", "valid", "value", "video", "viral", "visit", "vital", "vocal", "voice",
  "voter", "waste", "watch", "water", "wheel", "where", "which", "while", "white", "whole",
  "whose", "women", "world", "worse", "worst", "worth", "would", "wound", "write", "wrong",
  "wrote", "young", "youth",
  // 6+ letter common words that appear in search results
  "online", "search", "promo", "coupon", "codes", "deals", "offers", "stores", "amazon",
  "google", "please", "update", "review", "source", "market", "number", "change", "simple",
  "result", "policy", "accept", "access", "across", "action", "active", "actual", "advice",
  "affect", "afford", "allows", "almost", "always", "amount", "annual", "answer", "anyway",
  "appear", "around", "arrive", "attack", "august", "basket", "battle", "beauty", "became",
  "become", "before", "behind", "belief", "belong", "better", "beyond", "border", "bottom",
  "bought", "branch", "breath", "bridge", "bright", "broken", "budget", "burden", "bureau",
  "button", "cancel", "carbon", "career", "caused", "center", "centre", "chance", "charge",
  "chosen", "church", "circle", "closed", "closer", "coffee", "column", "coming", "common",
  "comply", "cookie", "corner", "costly", "cotton", "couple", "course", "covers", "create",
  "credit", "crisis", "custom", "damage", "danger", "debate", "decade", "decide", "defeat",
  "defend", "define", "degree", "demand", "depend", "deploy", "deputy", "desert", "design",
  "desire", "detail", "detect", "device", "dinner", "direct", "doctor", "domain", "double",
  "dozens", "driven", "driver", "during", "easily", "eating", "editor", "effect", "effort",
  "eighth", "either", "eleven", "emerge", "empire", "enable", "ending", "energy", "engage",
  "engine", "enough", "ensure", "entire", "entity", "equity", "escape", "estate", "ethnic",
  "evolve", "exceed", "except", "excess", "excuse", "exempt", "expand", "expect", "expert",
  "export", "expose", "extend", "extent", "fabric", "facing", "factor", "failed", "fairly",
  "fallen", "family", "famous", "farmer", "father", "favour", "female", "figure", "filter",
  "finger", "finish", "fiscal", "flight", "flying", "follow", "footer", "forced", "forest",
  "forget", "formal", "format", "former", "foster", "fourth", "french", "friend", "frozen",
  "future", "gained", "garden", "gather", "gender", "gentle", "german", "giving", "global",
  "golden", "govern", "growth", "guilty", "guitar", "handle", "happen", "hardly", "hasn't",
  "header", "health", "helped", "hidden", "highly", "honest", "hoping", "hunger", "hunter",
  "ignore", "impact", "import", "impose", "income", "indeed", "inform", "injury", "insert",
  "inside", "intact", "intend", "invest", "island", "itself", "jersey", "keeper", "kicked",
  "killer", "kindly", "knight", "ladder", "launch", "lawyer", "leader", "league", "lender",
  "lesson", "letter", "likely", "linked", "liquid", "listed", "listen", "little", "living",
  "locate", "longer", "mainly", "manner", "margin", "marine", "marked", "matter", "medium",
  "member", "memory", "mental", "merely", "method", "middle", "mighty", "miller", "mining",
  "minute", "mirror", "mobile", "modern", "modest", "moment", "modify", "mostly", "motion",
  "murder", "museum", "mutual", "myself", "namely", "narrow", "nation", "native", "nature",
  "nearby", "nearly", "needed", "newest", "ninety", "nobody", "normal", "notice", "object",
  "obtain", "occupy", "option", "orange", "origin", "others", "output", "oxford", "packed",
  "palace", "parent", "partly", "patent", "people", "period", "permit", "person", "phrase",
  "picked", "planet", "player", "plenty", "pocket", "poetry", "poison", "portal", "poster",
  "potato", "prefer", "profit", "proper", "proven", "public", "pursue", "racial", "random",
  "reader", "reason", "recent", "record", "reduce", "reform", "regard", "regime", "region",
  "reject", "relate", "relief", "remain", "remove", "render", "rental", "repair", "repeat",
  "report", "rescue", "resign", "resist", "resort", "retain", "retire", "return", "reveal",
  "reward", "rhythm", "rising", "robust", "ruling", "runway", "sacred", "safety", "salary",
  "sample", "saying", "scheme", "school", "screen", "script", "search", "season", "secret",
  "sector", "secure", "seeing", "seemed", "select", "seller", "senior", "series", "server",
  "settle", "severe", "shadow", "shared", "should", "signal", "silent", "silver", "simply",
  "single", "slight", "smooth", "soccer", "social", "solely", "sought", "speech", "spirit",
  "spread", "spring", "square", "stable", "status", "steady", "stolen", "strain", "strand",
  "stream", "street", "stress", "strict", "strike", "string", "stroke", "strong", "struck",
  "studio", "submit", "sudden", "suffer", "summit", "supply", "surely", "survey", "switch",
  "symbol", "talent", "target", "taught", "temple", "tenant", "tender", "terror", "thanks",
  "theirs", "theory", "thirty", "thorny", "though", "threat", "thrown", "ticket", "timber",
  "tissue", "toward", "travel", "treaty", "tribal", "tricky", "trophy", "turned", "twelve",
  "twenty", "unfair", "unique", "unless", "unlike", "unrest", "unused", "upbeat", "useful",
  "valley", "varied", "vendor", "versus", "victim", "viewer", "virgin", "virtue", "vision",
  "visual", "volume", "voting", "walker", "warmly", "wealth", "weapon", "weekly", "weight",
  "wholly", "widely", "window", "winner", "winter", "wisdom", "within", "wonder", "wooden",
  "worker", "worthy", "writer",
  // German common words (seen in screenshot)
  "auf", "und", "der", "die", "das", "ein", "eine", "mit", "von", "den", "ist", "dem",
  "des", "fur", "wir", "sie", "hat", "bei", "aus", "wie", "als", "nur", "bis", "zum",
  "doch", "auch", "nach", "oder", "wenn", "aber", "welt", "mehr", "noch", "sich", "wird",
  "sein", "kann", "gibt", "uber", "alle", "diese", "dass", "denn", "hier", "dann", "ganz",
  "sehr", "zwei", "drei", "mann", "frau", "kind", "land", "zeit", "jahr", "haus", "teil",
  "hand", "wort", "werk", "bild", "recht", "gross", "klein", "lange", "letzt", "eigen",
  "heute", "immer", "schon", "jetzt", "unter", "durch", "gegen", "zwischen",
  // Swedish common words
  "och", "att", "det", "som", "har", "med", "var", "hon", "han", "vad", "kan", "ska",
  "inte", "alla", "bara", "hela", "till", "denna", "eller", "efter", "sedan", "andra",
  "denna", "inga", "sina", "vara", "utan", "stor", "ovan", "bort", "fler", "mest",
  // French
  "les", "des", "est", "une", "pas", "que", "sur", "par", "pour", "dans", "avec",
  "tout", "bien", "plus", "fait", "nous", "vous", "leur", "mais", "sont", "cela",
  // Common web/search terms
  "cookies", "privacy", "terms", "conditions", "shipping", "delivery", "returns",
  "contact", "support", "account", "shopping", "discount", "percent", "savings",
  "checkout", "payment", "purchase", "products", "category", "featured", "popular",
  "trending", "website", "browser", "measure", "content", "display", "germany",
  "english", "spanish", "twitter", "facebook", "youtube", "instagram", "linkedin",
  "pinterest", "reddit", "tiktok", "whatsapp", "telegram",
]);

/**
 * Validate whether a string looks like a real coupon code vs a random word.
 */
function isValidCouponCode(code: string): boolean {
  if (!code || code.length < 3 || code.length > 25) return false;

  const upper = code.toUpperCase();

  // Blocklist check (case-insensitive)
  if (BLOCKLIST.has(code.toLowerCase())) return false;

  // Must be mostly alphanumeric (allow hyphens and underscores in codes)
  if (!/^[A-Z0-9_-]+$/i.test(code)) return false;

  const hasLetter = /[A-Z]/i.test(code);
  const hasDigit = /[0-9]/.test(code);

  // Best case: contains both letters AND digits (e.g., SAVE20, 10OFF, FALL2024)
  if (hasLetter && hasDigit) return true;

  // Pure letter codes must be ≥5 chars and all uppercase to look promotional
  if (hasLetter && !hasDigit) {
    if (code.length >= 5 && code === upper) return true;
    return false;
  }

  // Pure numbers are almost never coupon codes
  if (hasDigit && !hasLetter) return false;

  return false;
}

/**
 * Extract coupon codes from text content (Firecrawl markdown or any text).
 * Uses strict validation to avoid capturing random words.
 */
function extractCouponsFromText(text: string, domain: string): any[] {
  const coupons: any[] = [];
  const seenCodes = new Set<string>();

  // Pattern: look for coupon-like codes near coupon keywords
  const codePatterns = [
    /(?:code|coupon|promo|voucher|rabatt|kupong|gutschein)[:\s]+["'`]?([A-Z0-9_-]{3,25})["'`]?/gi,
    /["'`]([A-Z0-9_-]{4,25})["'`]\s*(?:for|gives?|get|save|off|rabatt)/gi,
    /(?:use|enter|apply|använd|nutze)\s+["'`]?([A-Z0-9_-]{3,25})["'`]?/gi,
    /(?:code|kod|kode|gutscheincode)[:\s]*([A-Z][A-Z0-9_-]{2,24})/gi,
    // Markdown bold/code patterns: **CODE** or `CODE`
    /\*\*([A-Z0-9_-]{4,25})\*\*/g,
    /`([A-Z0-9_-]{4,25})`/g,
  ];

  for (const pattern of codePatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const code = match[1].trim().toUpperCase();

      if (seenCodes.has(code)) continue;
      if (!isValidCouponCode(code)) continue;

      seenCodes.add(code);

      // Try to extract discount info from surrounding context
      const idx = text.indexOf(match[1]);
      const context = text.substring(Math.max(0, idx - 120), idx + match[1].length + 120);
      const discountMatch = context.match(/(\d{1,3})\s*%\s*(?:off|rabatt|discount|av|Rabatt)/i);
      const fixedMatch = context.match(/(?:\$|€|£|kr)\s*(\d+(?:[.,]\d{2})?)\s*(?:off|rabatt|discount|av)/i);
      const freeShip = /free.?ship|gratis.?frakt|fri.?frakt|kostenlos.?versand/i.test(context);

      let discount_type = "other";
      let discount_value: string | null = null;
      let description = `Coupon code for ${domain}`;

      if (discountMatch) {
        discount_type = "percentage";
        discount_value = discountMatch[1] + "%";
        description = `${discountMatch[1]}% off`;
      } else if (fixedMatch) {
        discount_type = "fixed";
        discount_value = fixedMatch[1];
        description = `${fixedMatch[0].trim()} off`;
      } else if (freeShip) {
        discount_type = "free_shipping";
        description = "Free shipping";
      }

      coupons.push({ code, description, discount_type, discount_value });
    }
  }

  return coupons;
}
