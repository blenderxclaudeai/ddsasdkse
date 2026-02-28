import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ExtensionLayout } from "@/components/ExtensionLayout";

interface TryonResult {
  id: string;
  title: string | null;
  image_url: string;
  result_image_url: string | null;
  status: string;
  created_at: string;
  retailer_domain: string | null;
  price: string | null;
}

export default function Showroom() {
  const { user } = useAuth();
  const [results, setResults] = useState<TryonResult[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <ExtensionLayout>
      <div className="p-6">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Showroom</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Your virtual try-on results</p>

        {loading ? (
          <div className="mt-6 grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-secondary" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="mt-20 text-center">
            <p className="text-[14px] text-muted-foreground">No try-ons yet</p>
            <p className="mt-1 text-[12px] text-muted-foreground/60">
              Use the browser extension to try on items
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {completedResults.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {completedResults.map(r => (
                  <div key={r.id} className="group relative">
                    <img
                      src={r.result_image_url!}
                      alt={r.title || "Try-on result"}
                      className="aspect-[3/4] w-full rounded-xl object-cover"
                    />
                    {(r.title || r.price) && (
                      <div className="mt-1.5 px-0.5">
                        {r.title && <p className="truncate text-[12px] font-medium text-foreground">{r.title}</p>}
                        {r.price && <p className="text-[11px] text-muted-foreground">{r.price}</p>}
                      </div>
                    )}
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
    </ExtensionLayout>
  );
}
