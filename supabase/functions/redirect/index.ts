import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Domain allowlist for redirect targets (prevents open redirect attacks)
const ALLOWED_REDIRECT_DOMAINS: string[] = [
  // Add merchant domains here, e.g.:
  // "amazon.com", "www.amazon.com",
  // "zara.com", "www.zara.com",
];

function isDomainAllowed(hostname: string): boolean {
  // Read allowlist override from environment (comma-separated domains)
  const envDomains = Deno.env.get("ALLOWED_REDIRECT_DOMAINS");
  const domains = envDomains
    ? envDomains.split(",").map((d) => d.trim()).filter(Boolean)
    : ALLOWED_REDIRECT_DOMAINS;

  // Fail closed in production: if no domains configured, block all redirects
  if (domains.length === 0) {
    console.warn("[redirect] No allowed domains configured — blocking redirect (fail-closed).");
    return false;
  }

  const normalized = hostname.toLowerCase().replace(/^www\./, "");
  return domains.some((d) => {
    const normalizedAllowed = d.toLowerCase().replace(/^www\./, "");
    return normalized === normalizedAllowed || normalized.endsWith(`.${normalizedAllowed}`);
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const target = url.searchParams.get("target");
    const retailerDomain = url.searchParams.get("retailerDomain");
    const clickRef = url.searchParams.get("clickRef");

    if (!target) {
      return new Response(JSON.stringify({ error: "target parameter required" }), { status: 400, headers: corsHeaders });
    }

    // Validate URL (only http/https)
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(target);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return new Response(JSON.stringify({ error: "Invalid URL protocol" }), { status: 400, headers: corsHeaders });
      }
    } catch {
      return new Response(JSON.stringify({ error: "Invalid URL" }), { status: 400, headers: corsHeaders });
    }

    // Check domain allowlist to prevent open redirect attacks
    if (!isDomainAllowed(parsedUrl.hostname)) {
      return new Response(JSON.stringify({ error: "Redirect domain not allowed" }), { status: 403, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Try to get user from auth header
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const anonClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await anonClient.auth.getUser();
      userId = user?.id ?? null;
    }

    // Record click event
    await supabase.from("click_events").insert({
      user_id: userId,
      target_url: target,
      retailer_domain: retailerDomain || parsedUrl.hostname,
      click_ref: clickRef,
    });

    // Check for affiliate merchant
    let finalUrl = target;
    if (retailerDomain || parsedUrl.hostname) {
      const { data: merchant } = await supabase
        .from("affiliate_merchants")
        .select("affiliate_link_template")
        .eq("domain", retailerDomain || parsedUrl.hostname)
        .maybeSingle();

      if (merchant?.affiliate_link_template) {
        finalUrl = merchant.affiliate_link_template.replace("{TARGET_URL}", encodeURIComponent(target));
      }
    }

    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: finalUrl },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
