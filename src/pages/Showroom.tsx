import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ExtensionLayout } from "@/components/ExtensionLayout";
import { ShoppingCart } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface TryonResult {
  id: string;
  title: string | null;
  image_url: string;
  result_image_url: string | null;
  status: string;
  created_at: string;
  retailer_domain: string | null;
  price: string | null;
  page_url: string;
}

export default function Showroom() {
  const { user, session } = useAuth();
  const [results, setResults] = useState<TryonResult[]>([]);
  const [loading, setLoading] = useState(true);

  // Check for pending product data from the Chrome extension content script
  useEffect(() => {
    if (!user || !session) return;
    const isExtension =
      typeof chrome !== "undefined" &&
      typeof chrome.storage !== "undefined";
    if (!isExtension) return;

    chrome.storage.local.get("vto_pending_product", async (stored) => {
      const product = stored?.vto_pending_product;
      if (!product) return;

      // Clear immediately so we don't re-process
      chrome.storage.local.remove("vto_pending_product");

      // Auto-trigger a try-on request
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/tryon-request`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify(product),
        });
        // Reload results after the try-on request
        const { data } = await supabase
          .from("tryon_requests")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        setResults(data ?? []);
      } catch (e) {
        console.error("VTO: auto try-on failed", e);
      }
    });
  }, [user, session]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("tryon_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setResults(data ?? []);
      setLoading(false);
    };
    load();
  }, [user]);

  const completedResults = results.filter(r => r.result_image_url);
  const pendingResults = results.filter(r => !r.result_image_url);

  const getAffiliateUrl = (r: TryonResult) =>
    `${SUPABASE_URL}/functions/v1/redirect?target=${encodeURIComponent(r.page_url)}&retailerDomain=${r.retailer_domain ?? ""}`;

  return (
    <ExtensionLayout>
      <div className="flex h-full flex-col p-8">
        {/* Header */}
        <div className="pt-2 text-center">
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">Showroom</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">See how products look on you</p>
        </div>

        {/* Content */}
        <div className="flex-1 py-6">
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-secondary" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
                <span className="text-[24px] text-muted-foreground">—</span>
              </div>
              <p className="mt-4 text-[14px] font-medium text-foreground">Nothing here yet</p>
              <p className="mt-1 max-w-[240px] text-[12px] leading-relaxed text-muted-foreground">
                Browse any online store and try products on yourself — clothes, glasses, jewelry, and more.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {completedResults.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {completedResults.map(r => (
                    <div key={r.id} className="group relative">
                      <img
                        src={r.result_image_url!}
                        alt={r.title || "Try-on result"}
                        className="aspect-[3/4] w-full rounded-xl object-cover"
                      />
                      {(r.title || r.price || r.retailer_domain) && (
                        <div className="mt-1.5 px-0.5">
                          {r.title && <p className="truncate text-[12px] font-medium text-foreground">{r.title}</p>}
                          <div className="flex items-center gap-1.5">
                            {r.price && <span className="text-[11px] text-muted-foreground">{r.price}</span>}
                            {r.retailer_domain && (
                              <span className="text-[10px] text-muted-foreground/50">{r.retailer_domain}</span>
                            )}
                          </div>
                        </div>
                      )}
                      <a
                        href={getAffiliateUrl(r)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
                      >
                        <ShoppingCart size={12} />
                        Add to Cart
                      </a>
                    </div>
                  ))}
                </div>
              )}

              {pendingResults.length > 0 && (
                <div>
                  <p className="mb-3 text-[12px] font-medium text-muted-foreground">Processing</p>
                  <div className="grid grid-cols-2 gap-3">
                    {pendingResults.map(r => (
                      <div key={r.id} className="relative">
                        <img
                          src={r.image_url}
                          alt={r.title || "Processing"}
                          className="aspect-[3/4] w-full rounded-xl object-cover opacity-50"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="rounded-lg bg-background/80 px-2 py-1 text-[11px] font-medium text-muted-foreground">
                            {r.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ExtensionLayout>
  );
}
