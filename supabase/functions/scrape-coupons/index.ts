import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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

    // Check for fresh cached coupons (scraped within last 24h)
    const { data: cached } = await supabase
      .from("retailer_coupons")
      .select("code,description,discount_type,discount_value,min_purchase,scraped_at")
      .eq("domain", cleanDomain)
      .eq("is_active", true);

    if (cached && cached.length > 0) {
      const hasFreshScraped = cached.some(
        (c: any) => c.scraped_at && Date.now() - new Date(c.scraped_at).getTime() < CACHE_TTL_MS
      );
      const manualCoupons = cached.filter((c: any) => !c.scraped_at);

      if (hasFreshScraped || manualCoupons.length > 0) {
        return new Response(
          JSON.stringify({ coupons: cached.map(({ scraped_at, ...rest }: any) => rest) }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Use AI to discover coupons (aggregator scraping is blocked by Cloudflare)
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ coupons: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    try {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are a coupon code expert. Return only valid JSON arrays of coupon codes. Be honest — if you don't know any codes, return an empty array." },
            { role: "user", content: aiPrompt },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!aiRes.ok) {
        console.error("AI request failed:", aiRes.status);
        return new Response(JSON.stringify({ coupons: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiData = await aiRes.json();
      const content = aiData?.choices?.[0]?.message?.content || "[]";

      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch {
        const match = content.match(/\[[\s\S]*\]/);
        parsed = match ? JSON.parse(match[0]) : [];
      }

      const coupons: any[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.coupons)
        ? parsed.coupons
        : [];

      if (coupons.length === 0) {
        return new Response(JSON.stringify({ coupons: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete old scraped coupons for this domain
      await supabase
        .from("retailer_coupons")
        .delete()
        .eq("domain", cleanDomain)
        .not("scraped_at", "is", null);

      // Insert new AI-discovered coupons
      const now = new Date().toISOString();
      const expires = new Date(Date.now() + CACHE_TTL_MS).toISOString();
      const rows = coupons.slice(0, 15).map((c: any) => ({
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

      if (insertError) {
        console.error("Insert error:", insertError);
      }

      const result = rows.map(({ scraped_at, expires_at, is_active, ...rest }) => rest);
      return new Response(JSON.stringify({ coupons: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (aiError) {
      console.error("AI discovery error:", aiError);
      return new Response(JSON.stringify({ coupons: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("scrape-coupons error:", err);
    return new Response(JSON.stringify({ error: "Internal error", coupons: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
