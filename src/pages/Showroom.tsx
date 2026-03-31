import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ExtensionLayout } from "@/components/ExtensionLayout";
import { ExternalLink, Download, Share2, Trash2, Camera } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import ResultLightbox from "@/components/ResultLightbox";

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
  const [lightboxResult, setLightboxResult] = useState<TryonResult | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [shareToast, setShareToast] = useState<string | null>(null);

  const loadResults = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("tryon_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setResults(data ?? []);
    setLoading(false);
  }, [user]);

  // Check for pending product data from the Chrome extension
  useEffect(() => {
    if (!user || !session) return;
    const isExtension =
      typeof chrome !== "undefined" && typeof chrome.storage !== "undefined";
    if (!isExtension) return;

    chrome.storage.local.get("vto_pending_product", async (stored) => {
      const product = stored?.vto_pending_product;
      if (!product) return;
      chrome.storage.local.remove("vto_pending_product");
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
        await loadResults();
      } catch (e) {
        console.error("VTO: auto try-on failed", e);
      }
    });
  }, [user, session, loadResults]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  const completedResults = results.filter((r) => r.result_image_url);
  const pendingResults = results.filter((r) => !r.result_image_url);

  // Unique retailers for filter
  const retailers = Array.from(
    new Set(completedResults.map((r) => r.retailer_domain).filter(Boolean))
  ) as string[];

  const filteredCompleted =
    filter === "all"
      ? completedResults
      : completedResults.filter((r) => r.retailer_domain === filter);

  const getAffiliateUrl = (r: TryonResult) =>
    `${SUPABASE_URL}/functions/v1/redirect?target=${encodeURIComponent(r.page_url)}&retailerDomain=${r.retailer_domain ?? ""}`;

  const handleDownload = async (r: TryonResult) => {
    try {
      const res = await fetch(r.result_image_url!);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cartify-${r.title || "tryon"}-${r.id.slice(0, 6)}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      console.error("Download failed");
    }
  };

  const handleShare = async (r: TryonResult) => {
    try {
      const res = await fetch(r.result_image_url!);
      const blob = await res.blob();
      const file = new File([blob], `cartify-${r.title || "tryon"}.jpg`, { type: blob.type });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: r.title || "My try-on look" });
        return;
      }
      try {
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        setShareToast("Image copied to clipboard!");
        setTimeout(() => setShareToast(null), 2500);
        return;
      } catch {}
      await handleDownload(r);
      setShareToast("Image downloaded!");
      setTimeout(() => setShareToast(null), 2500);
    } catch {
      try {
        await handleDownload(r);
        setShareToast("Image downloaded!");
      } catch {
        setShareToast("Couldn't share or download");
      }
      setTimeout(() => setShareToast(null), 2500);
    }
  };

  const handleDelete = async (r: TryonResult) => {
    await supabase.from("tryon_requests").delete().eq("id", r.id);
    setResults((prev) => prev.filter((x) => x.id !== r.id));
  };

  return (
    <ExtensionLayout>
      <div className="relative flex h-full flex-col p-8">
        {shareToast && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-foreground px-4 py-2 text-[12px] font-medium text-background shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
            {shareToast}
          </div>
        )}

        {/* Header */}
        <div className="pt-2 text-center">
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">Showroom</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">Your try-on results</p>
        </div>

        {/* Filter chips */}
        {retailers.length > 1 && (
          <div className="mt-4 flex gap-1.5 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setFilter("all")}
              className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                filter === "all"
                  ? "bg-foreground text-background"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            {retailers.map((r) => (
              <button
                key={r}
                onClick={() => setFilter(r)}
                className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                  filter === r
                    ? "bg-foreground text-background"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 py-6">
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-[3/4] w-full rounded-xl" />
                  <Skeleton className="h-3 w-3/4 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                </div>
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
                <Camera className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="mt-4 text-[15px] font-medium text-foreground">No try-ons yet</p>
              <p className="mt-2 max-w-[260px] text-[13px] leading-relaxed text-muted-foreground">
                Step 1: Upload a photo of yourself on the Profile tab.<br />
                Step 2: Browse any store and click "Try On" on a product.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredCompleted.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {filteredCompleted.map((r) => (
                    <div key={r.id} className="group relative">
                      <img
                        src={r.result_image_url!}
                        alt={r.title || "Try-on result"}
                        className="aspect-[3/4] w-full rounded-xl object-cover cursor-pointer transition-opacity hover:opacity-90"
                        loading="lazy"
                        onClick={() => {
                          setCompareMode(false);
                          setLightboxResult(r);
                        }}
                      />
                      {/* Delete button on hover */}
                      <button
                        onClick={() => handleDelete(r)}
                        className="absolute top-2 right-2 rounded-lg bg-background/80 p-1.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                      {(r.title || r.price || r.retailer_domain) && (
                        <div className="mt-1.5 px-0.5">
                          {r.title && (
                            <p className="truncate text-[12px] font-medium text-foreground">
                              {r.title}
                            </p>
                          )}
                          <div className="flex items-center gap-1.5">
                            {r.price && (
                              <span className="text-[11px] text-muted-foreground">{r.price}</span>
                            )}
                            {r.retailer_domain && (
                              <span className="text-[10px] text-muted-foreground/50">
                                {r.retailer_domain}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="mt-1.5 flex gap-1.5">
                        <a
                          href={getAffiliateUrl(r)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
                        >
                          <ExternalLink size={12} />
                          View Item
                        </a>
                        <button
                          onClick={() => handleDownload(r)}
                          title="Download"
                          className="flex items-center justify-center rounded-lg border border-border bg-background px-2 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={() => handleShare(r)}
                          title="Share"
                          className="flex items-center justify-center rounded-lg border border-border bg-background px-2 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <Share2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {pendingResults.length > 0 && (
                <div>
                  <p className="mb-3 text-[12px] font-medium text-muted-foreground">Processing</p>
                  <div className="grid grid-cols-2 gap-3">
                    {pendingResults.map((r) => (
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

      {/* Lightbox */}
      {lightboxResult && (
        <ResultLightbox
          result={lightboxResult}
          onClose={() => setLightboxResult(null)}
          onDownload={handleDownload}
          onShare={handleShare}
          onDelete={handleDelete}
          affiliateUrl={getAffiliateUrl(lightboxResult)}
          compareMode={compareMode}
          onToggleCompare={() => setCompareMode((p) => !p)}
        />
      )}
    </ExtensionLayout>
  );
}
