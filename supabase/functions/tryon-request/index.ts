import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing Authorization: Bearer <user_jwt> header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace("Bearer ", "");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Detect if extension is sending anon key instead of user JWT
    if (token === anonKey) {
      return new Response(JSON.stringify({ error: "Authorization header must contain a user JWT, not the anon key. Use the token from your Profile page." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      anonKey,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid or expired JWT. Re-copy token from Profile page." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const { pageUrl, imageUrl, title, price, retailerDomain } = body;

    if (!pageUrl || !imageUrl) {
      return new Response(JSON.stringify({ error: "pageUrl and imageUrl required" }), { status: 400, headers: corsHeaders });
    }

    // Mock result: in production, call actual AI model here
    const resultImageUrl = `https://placehold.co/400x600/7c3aed/white?text=VTO+Try-On`;

    const { data, error } = await supabase.from("tryon_requests").insert({
      user_id: userId,
      page_url: pageUrl,
      image_url: imageUrl,
      title: title || null,
      price: price || null,
      retailer_domain: retailerDomain || null,
      status: "completed",
      result_image_url: resultImageUrl,
    }).select().single();

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });

    return new Response(JSON.stringify({
      tryOnId: data.id,
      status: data.status,
      resultImageUrl: data.result_image_url,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
