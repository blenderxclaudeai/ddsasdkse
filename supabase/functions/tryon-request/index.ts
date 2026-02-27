import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const body = await req.json();
    const { pageUrl, imageUrl, title, price, retailerDomain } = body;

    if (!pageUrl || !imageUrl) {
      return new Response(JSON.stringify({ error: "pageUrl and imageUrl required" }), { status: 400, headers: corsHeaders });
    }

    // Mock result: in production, call actual AI model here
    const resultImageUrl = `https://placehold.co/400x600/7c3aed/white?text=VTO+Try-On`;

    const { data, error } = await supabase.from("tryon_requests").insert({
      user_id: user.id,
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
