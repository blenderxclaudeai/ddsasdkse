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

    // ── Tier 2: Google search scraping (free, no API credits) ──
    let googleCoupons: any[] = [];
    try {
      const year = new Date().getFullYear();
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(cleanDomain)}+coupon+code+${year}&num=10&hl=en`;
      const googleRes = await fetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      if (googleRes.ok) {
        const html = await googleRes.text();
        googleCoupons = extractCouponsFromSearchHtml(html, cleanDomain);
        console.log(`[scrape-coupons] Google search found ${googleCoupons.length} codes for ${cleanDomain}`);
      }
    } catch (e) {
      console.error("[scrape-coupons] Google search failed:", e);
    }

    // ── Tier 3: AI fallback (only if Google found nothing) ──
    if (googleCoupons.length === 0) {
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
            googleCoupons = aiCodes.map((c: any) => ({
              code: String(c.code || "").slice(0, 50),
              description: String(c.description || "").slice(0, 200),
              discount_type: c.discount_type || "other",
              discount_value: c.discount_value ? String(c.discount_value).slice(0, 50) : null,
            }));
          } else {
            console.error("[scrape-coupons] AI request failed:", aiRes.status);
          }
        } catch (e) {
          console.error("[scrape-coupons] AI fallback error:", e);
        }
      }
    }

    // If we found coupons, persist them
    if (googleCoupons.length > 0) {
      // Delete old scraped coupons for this domain
      await supabase
        .from("retailer_coupons")
        .delete()
        .eq("domain", cleanDomain)
        .not("scraped_at", "is", null);

      const now = new Date().toISOString();
      const expires = new Date(Date.now() + CACHE_TTL_MS).toISOString();
      const rows = googleCoupons.slice(0, 15).map((c: any) => ({
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

      const aiResults = rows.map(({ scraped_at, expires_at, is_active, ...rest }) => rest);
      const manualResults = manualCoupons.map(({ scraped_at, ...rest }: any) => rest);
      return new Response(JSON.stringify({ coupons: [...manualResults, ...aiResults] }), {
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

/**
 * Extract coupon codes from Google search result HTML snippets.
 * Looks for patterns like "Use code SAVE20" or "code: SUMMER25" near coupon-related keywords.
 */
function extractCouponsFromSearchHtml(html: string, domain: string): any[] {
  const coupons: any[] = [];
  const seenCodes = new Set<string>();

  // Remove HTML tags but keep text content — work with visible snippets
  const textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");

  // Pattern 1: "code" or "coupon" followed by an all-caps/alphanumeric code
  const codePatterns = [
    /(?:code|coupon|promo|voucher|rabatt|kupong)[:\s]+["']?([A-Z0-9]{3,20})["']?/gi,
    /["']([A-Z0-9]{4,20})["']\s*(?:for|gives?|get|save|off|rabatt)/gi,
    /(?:use|enter|apply|använd)\s+["']?([A-Z0-9]{3,20})["']?/gi,
    /(?:code|kod|kode)[:\s]*([A-Z][A-Z0-9]{2,19})/gi,
  ];

  for (const pattern of codePatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(textContent)) !== null) {
      const code = match[1].trim();
      if (code.length < 3 || code.length > 20) continue;
      if (seenCodes.has(code)) continue;
      // Skip common false positives
      if (/^(THE|AND|FOR|OFF|GET|USE|BUY|NOW|NEW|TOP|ALL|HOW|OUR|OUT|SEE|TRY|ITS)$/i.test(code)) continue;
      if (/^[0-9]+$/.test(code) && code.length < 4) continue; // pure short numbers

      seenCodes.add(code);

      // Try to extract discount info from surrounding context (100 chars around)
      const idx = textContent.indexOf(code);
      const context = textContent.substring(Math.max(0, idx - 100), idx + code.length + 100);
      const discountMatch = context.match(/(\d{1,3})\s*%\s*(?:off|rabatt|discount|av)/i);
      const fixedMatch = context.match(/(?:\$|€|£|kr)\s*(\d+(?:[.,]\d{2})?)\s*(?:off|rabatt|discount|av)/i);
      const freeShip = /free.?ship|gratis.?frakt|fri.?frakt/i.test(context);

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
