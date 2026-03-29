import React, { useEffect, useState } from "react";
import { signInWithOAuth, signOut } from "@ext/lib/auth";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type Screen = "session" | "showroom" | "profile" | "settings";

interface StoredUser {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
}

interface TryonResult {
  id: string;
  title: string | null;
  image_url: string;
  result_image_url: string | null;
  status: string;
  price: string | null;
  page_url: string;
  retailer_domain: string | null;
}

interface SessionItem {
  id: string;
  product_url: string;
  product_title: string | null;
  product_image: string | null;
  product_price: string | null;
  retailer_domain: string | null;
  interaction_type: string;
  in_cart: boolean;
  tryon_request_id: string | null;
  created_at: string;
}

interface PhotoRecord {
  id: string;
  category: string;
  storage_path: string;
  signedUrl?: string;
}


const CATEGORY_GROUPS = [
  {
    label: "Body",
    categories: [
      { key: "full_body", label: "Full Body" },
      { key: "upper_body", label: "Upper Body" },
      { key: "lower_body", label: "Lower Body" },
      { key: "back", label: "Back" },
      { key: "lower_back", label: "Lower Back" },
      { key: "arms", label: "Arms" },
    ],
  },
  {
    label: "Head",
    categories: [
      { key: "head", label: "Head" },
      { key: "face", label: "Face" },
      { key: "eyes", label: "Eyes" },
      { key: "lips", label: "Lips" },
      { key: "brows", label: "Brows" },
      { key: "hair", label: "Hair" },
      { key: "ears", label: "Ears" },
    ],
  },
  {
    label: "Extremities",
    categories: [
      { key: "hands", label: "Hands" },
      { key: "fingers", label: "Fingers" },
      { key: "nails", label: "Nails" },
      { key: "feet", label: "Feet" },
    ],
  },
];

const ALL_CATEGORIES = CATEGORY_GROUPS.flatMap((g) => g.categories);

interface CartifyAppProps {
  mode: "popup" | "sidepanel";
}

export function CartifyApp({ mode }: CartifyAppProps) {
  const [user, setUser] = useState<any | null>(null);
  const [storedUser, setStoredUser] = useState<StoredUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [screen, setScreen] = useState<Screen>("session");

  // Try-on state
  const [results, setResults] = useState<TryonResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);

  // Session state
  const [sessionItems, setSessionItems] = useState<SessionItem[]>([]);
  const [sessionLoading, setSessionLoading] = useState(false);

  // Profile photo state
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  // Settings state
  const [displayMode, setDisplayMode] = useState<"popup" | "sidepanel">(mode);

  // Lightbox state
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Variant selection flow state
  const [variantFlow, setVariantFlow] = useState<SessionItem[] | null>(null);
  const [variantFlowIndex, setVariantFlowIndex] = useState(0);
  const [variantSelections, setVariantSelections] = useState<Record<string, { size: string; color: string }>>({});
  const [extractedVariants, setExtractedVariants] = useState<Record<string, { sizes: string[]; colors: string[] }>>({});
  const [variantsLoading, setVariantsLoading] = useState(false);

  // Session dirty tracking for back arrow
  const [sessionDirty, setSessionDirty] = useState(false);

  // Coupon state
  const [couponsByDomain, setCouponsByDomain] = useState<Record<string, any[]>>({});
  const [couponsExpanded, setCouponsExpanded] = useState(false);

  // Filter coupons to only show for domains that have products in the session
  const sessionDomains = new Set(sessionItems.map((item) => item.retailer_domain).filter(Boolean));
  const filteredCouponsByDomain: Record<string, any[]> = {};
  for (const [domain, coupons] of Object.entries(couponsByDomain)) {
    if (sessionDomains.has(domain)) {
      filteredCouponsByDomain[domain] = coupons;
    }
  }
  const activeCoupons = Object.values(filteredCouponsByDomain).flat();

  // Initialize auth + pending product
  useEffect(() => {
    chrome.storage.local.get(
      ["cartify_auth_token", "cartify_user", "cartify_display_mode", "cartify_coupons_by_domain", "cartify_auth_pending"],
      (result) => {
        if (result.cartify_auth_token && result.cartify_user) {
          setStoredUser(result.cartify_user);
          setUser({ id: result.cartify_user.id });
        } else if (result.cartify_auth_pending) {
          setAuthLoading(true);
        }
        if (result.cartify_display_mode) {
          setDisplayMode(result.cartify_display_mode);
        }
        if (result.cartify_coupons_by_domain) {
          setCouponsByDomain(result.cartify_coupons_by_domain);
        }
        setLoading(false);
      }
    );

    const listener = (
      changes: Record<string, { oldValue?: any; newValue?: any }>,
      area: string
    ) => {
      if (area !== "local") return;
      if (changes.cartify_auth_token?.newValue && changes.cartify_user?.newValue) {
        const u = changes.cartify_user.newValue;
        setStoredUser(u);
        setUser({ id: u.id });
        setAuthLoading(false);
      }
      if (changes.cartify_auth_token && !changes.cartify_auth_token.newValue) {
        setUser(null);
        setStoredUser(null);
      }
      if (changes.cartify_coupons_by_domain?.newValue) {
        setCouponsByDomain(changes.cartify_coupons_by_domain.newValue);
      } else if (changes.cartify_coupons_by_domain && !changes.cartify_coupons_by_domain.newValue) {
        setCouponsByDomain({});
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  // Load try-on results when on showroom screen
  useEffect(() => {
    if (!storedUser || screen !== "showroom") return;
    loadResults();
  }, [storedUser, screen]);

  // Auto-refresh showroom when try-on results complete in background
  useEffect(() => {
    const listener = (
      changes: Record<string, { oldValue?: any; newValue?: any }>,
      area: string
    ) => {
      if (area !== "local") return;
      if (changes.cartify_recent_tryons?.newValue) {
        loadResults(false);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [storedUser]);

  // Auto-refresh session when background scripts mutate session items
  useEffect(() => {
    if (!storedUser) return;

    const listener = (
      changes: Record<string, { oldValue?: any; newValue?: any }>,
      area: string
    ) => {
      if (area !== "local") return;
      if (screen !== "session") return;
      if (changes.cartify_session_updated_at?.newValue) {
        loadSessionItems(false);
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [storedUser, screen]);

  // Reusable session items loader
  const loadSessionItems = async (showLoading = true) => {
    if (!storedUser) return;
    if (showLoading) setSessionLoading(true);

    const stored = await chrome.storage.local.get("cartify_auth_token");
    const token = stored.cartify_auth_token;
    if (!token) { setSessionLoading(false); return; }

    try {
      const sessRes = await fetch(
        `${SUPABASE_URL}/rest/v1/shopping_sessions?user_id=eq.${storedUser.id}&is_active=eq.true&expires_at=gt.${new Date().toISOString()}&order=started_at.desc&limit=1`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
      );
      const sessions = await sessRes.json();
      if (!Array.isArray(sessions) || sessions.length === 0) {
        setSessionItems([]);
        setSessionLoading(false);
        return;
      }

      const sessionId = sessions[0].id;
      const itemsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/session_items?session_id=eq.${sessionId}&order=created_at.desc`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
      );
      const items = await itemsRes.json();
      setSessionItems(Array.isArray(items) ? items : []);
    } catch {
      setSessionItems([]);
    }
    setSessionLoading(false);
  };

  // Reusable showroom results loader
  const loadResults = async (showLoading = true) => {
    if (!storedUser) return;
    if (showLoading) setResultsLoading(true);

    const stored = await chrome.storage.local.get("cartify_auth_token");
    const token = stored.cartify_auth_token;
    if (!token) { setResultsLoading(false); return; }

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/tryon_requests?user_id=eq.${storedUser.id}&order=created_at.desc`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    }
    setResultsLoading(false);
  };

  // Load session items when on session screen
  useEffect(() => {
    if (!storedUser || screen !== "session") return;
    loadSessionItems();
  }, [storedUser, screen]);

  // Load profile photos
  useEffect(() => {
    if (!storedUser || screen !== "profile") return;
    setPhotosLoading(true);

    chrome.storage.local.get("cartify_auth_token", async (result) => {
      const token = result.cartify_auth_token;
      if (!token) { setPhotosLoading(false); return; }

      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/profile_photos?user_id=eq.${storedUser.id}`,
          {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const data = await res.json();
        if (Array.isArray(data)) {
          const withUrls = await Promise.all(
            data.map(async (p: any) => {
              const signRes = await fetch(
                `${SUPABASE_URL}/storage/v1/object/sign/profile-photos/${p.storage_path}`,
                {
                  method: "POST",
                  headers: {
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ expiresIn: 3600 }),
                }
              );
              const signData = await signRes.json();
              return {
                ...p,
                signedUrl: signData?.signedURL
                  ? `${SUPABASE_URL}/storage/v1${signData.signedURL}`
                  : undefined,
              } as PhotoRecord;
            })
          );
          setPhotos(withUrls);
        }
      } catch {
        setPhotos([]);
      }
      setPhotosLoading(false);
    });
  }, [storedUser, screen]);

  const handleOAuth = async (provider: "google" | "apple") => {
    setAuthLoading(true);
    // Fire-and-forget: don't await the full auth flow
    // Auth completion is detected via the storage.onChanged listener above
    signInWithOAuth(provider);
  };

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
    setStoredUser(null);
    setResults([]);
    setPhotos([]);
    setSessionItems([]);
    setScreen("session");
  };

  const handleUpload = async (category: string, file: File) => {
    if (!storedUser) return;
    setUploading(category);

    const stored = await chrome.storage.local.get("cartify_auth_token");
    const token = stored.cartify_auth_token;
    if (!token) { setUploading(null); return; }

    const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` };
    const filePath = `${storedUser.id}/${category}-${Date.now()}`;

    const existing = photos.find((p) => p.category === category);
    if (existing) {
      await fetch(`${SUPABASE_URL}/storage/v1/object/profile-photos/${existing.storage_path}`, {
        method: "DELETE", headers,
      });
      await fetch(`${SUPABASE_URL}/rest/v1/profile_photos?id=eq.${existing.id}`, {
        method: "DELETE", headers,
      });
    }

    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/profile-photos/${filePath}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": file.type },
      body: file,
    });
    if (!uploadRes.ok) { setUploading(null); return; }

    await fetch(`${SUPABASE_URL}/rest/v1/profile_photos`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: storedUser.id, category, storage_path: filePath }),
    });

    setUploading(null);
    setPhotosLoading(true);
    setScreen("profile");
  };

  const handleDeletePhoto = async (photo: PhotoRecord) => {
    const stored = await chrome.storage.local.get("cartify_auth_token");
    const token = stored.cartify_auth_token;
    if (!token) return;

    const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` };

    await fetch(`${SUPABASE_URL}/storage/v1/object/profile-photos/${photo.storage_path}`, {
      method: "DELETE", headers,
    });
    await fetch(`${SUPABASE_URL}/rest/v1/profile_photos?id=eq.${photo.id}`, {
      method: "DELETE", headers,
    });
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  };

  const handleDisplayModeChange = (newMode: "popup" | "sidepanel") => {
    setDisplayMode(newMode);
    chrome.storage.local.set({ cartify_display_mode: newMode });
    chrome.runtime.sendMessage({ type: "DISPLAY_MODE_CHANGED", mode: newMode });
  };

  const [shareToast, setShareToast] = useState<string | null>(null);

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

      // Try clipboard
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob }),
        ]);
        setShareToast("Image copied to clipboard!");
        setTimeout(() => setShareToast(null), 2500);
        return;
      } catch {}

      // Fallback: auto-download
      await handleDownload(r);
      setShareToast("Image downloaded!");
      setTimeout(() => setShareToast(null), 2500);
    } catch {
      // Final fallback: try download
      try {
        await handleDownload(r);
        setShareToast("Image downloaded!");
      } catch {
        setShareToast("Couldn't share or download");
      }
      setTimeout(() => setShareToast(null), 2500);
    }
  };

  const handleAddToRetailerCart = (productUrl: string, retailerDomain?: string | null) => {
    if (!productUrl) return;

    chrome.runtime.sendMessage(
      {
        type: "CARTIFY_ADD_TO_RETAILER_CART",
        payload: {
          product_url: productUrl,
          retailer_domain: retailerDomain || undefined,
        },
      },
      (response) => {
        if (chrome.runtime.lastError) {
          setShareToast("Could not reach current tab");
          setTimeout(() => setShareToast(null), 2500);
          return;
        }

        if (response?.ok) {
          if (response.openedProductTab) {
            setShareToast("Opened retailer page and adding to cart…");
          } else {
            setShareToast("Added to retailer cart");
          }
        } else {
          setShareToast(response?.error || "Could not add to retailer cart");
        }
        setTimeout(() => setShareToast(null), 2500);
      }
    );
  };


  const handleRemoveSessionItem = async (item: SessionItem) => {
    const stored = await chrome.storage.local.get("cartify_auth_token");
    const token = stored.cartify_auth_token;
    if (!token) return;

    await fetch(`${SUPABASE_URL}/rest/v1/session_items?id=eq.${item.id}`, {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });
    setSessionItems((prev) => prev.filter((i) => i.id !== item.id));
    setSessionDirty(true);
    // Background re-sync to keep state fresh
    setTimeout(() => loadSessionItems(false), 500);
  };

  const handleToggleCart = async (item: SessionItem) => {
    const stored = await chrome.storage.local.get("cartify_auth_token");
    const token = stored.cartify_auth_token;
    if (!token) return;

    const newInCart = !item.in_cart;
    await fetch(`${SUPABASE_URL}/rest/v1/session_items?id=eq.${item.id}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ in_cart: newInCart, interaction_type: newInCart ? "cart" : "viewed" }),
    });
    setSessionItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, in_cart: newInCart, interaction_type: newInCart ? "cart" : "viewed" } : i
      )
    );
    setSessionDirty(true);
    chrome.storage.local.set({ cartify_session_updated_at: Date.now() });
    // Background re-sync to keep state fresh
    setTimeout(() => loadSessionItems(false), 500);
  };

  const handleTryOnSessionItem = (item: SessionItem) => {
    chrome.runtime.sendMessage(
      {
        type: "CARTIFY_TRYON_REQUEST",
        payload: {
          product_url: item.product_url,
          product_title: item.product_title || "",
          product_image: item.product_image || "",
        },
        background: true,
      },
      (response) => {
        if (response?.ok) {
          setShareToast("Try-on queued!");
          setTimeout(() => setShareToast(null), 2500);
            chrome.storage.local.set({ cartify_session_updated_at: Date.now() });
            setTimeout(() => loadSessionItems(false), 800);
        }
      }
    );
  };

  const startVariantFlow = () => {
    const currentCartItems = sessionItems.filter((i) => i.in_cart);
    if (currentCartItems.length === 0) return;
    setVariantSelections({});
    setExtractedVariants({});
    setVariantFlowIndex(0);
    setVariantFlow(currentCartItems);
    // Fetch variants for first item
    fetchVariantsForItem(currentCartItems[0]);
  };

  const fetchVariantsForItem = async (item: SessionItem) => {
    if (extractedVariants[item.id]) return; // already fetched

    // Check for pre-stored variants first (extracted at add-to-cart time)
    const key = `cartify_variants_${btoa(item.product_url).slice(0, 40)}`;
    const stored = await chrome.storage.local.get(key);
    if (stored[key] && (stored[key].sizes?.length || stored[key].colors?.length)) {
      setExtractedVariants((prev) => ({
        ...prev,
        [item.id]: {
          sizes: stored[key].sizes || [],
          colors: stored[key].colors || [],
        },
      }));
      return;
    }

    // Fallback: extract via background tab
    setVariantsLoading(true);
    chrome.runtime.sendMessage(
      { type: "CARTIFY_EXTRACT_VARIANTS", payload: { product_url: item.product_url } },
      (response) => {
        setVariantsLoading(false);
        if (response?.ok && response.variants) {
          setExtractedVariants((prev) => ({
            ...prev,
            [item.id]: {
              sizes: response.variants.sizes || [],
              colors: response.variants.colors || [],
            },
          }));
        }
      }
    );
  };

  const handleVariantNext = () => {
    if (!variantFlow) return;
    if (variantFlowIndex < variantFlow.length - 1) {
      const nextIdx = variantFlowIndex + 1;
      setVariantFlowIndex(nextIdx);
      fetchVariantsForItem(variantFlow[nextIdx]);
    } else {
      executeAddAllToRetailerCart();
    }
  };

  const handleVariantSkip = () => {
    // Kept for backwards compat but no longer used in UI
    handleVariantNext();
  };

  const executeAddAllToRetailerCart = () => {
    if (!variantFlow) return;
    const items = variantFlow;
    setVariantFlow(null);

    const groups: Record<string, SessionItem[]> = {};
    items.forEach((item) => {
      const domain = item.retailer_domain || "unknown";
      if (!groups[domain]) groups[domain] = [];
      groups[domain].push(item);
    });

    const storeCount = Object.keys(groups).length;
    setShareToast(`Adding to ${storeCount} store${storeCount !== 1 ? "s" : ""}…`);

    const allItems = Object.values(groups).flat();
    let idx = 0;

    const sendNext = () => {
      if (idx >= allItems.length) {
        // All items sent — clear cart items from session
        clearCartAfterAdd(allItems);
        return;
      }
      const item = allItems[idx];
      const variant = variantSelections[item.id];
      chrome.runtime.sendMessage(
        {
          type: "CARTIFY_ADD_TO_RETAILER_CART",
          payload: {
            product_url: item.product_url,
            retailer_domain: item.retailer_domain || undefined,
            variant: variant && (variant.size || variant.color) ? variant : undefined,
          },
        },
        () => {
          idx++;
          setTimeout(sendNext, 500);
        }
      );
    };
    sendNext();
  };

  const clearCartAfterAdd = async (addedItems: SessionItem[]) => {
    const stored = await chrome.storage.local.get("cartify_auth_token");
    const token = stored.cartify_auth_token;

    if (token) {
      // Mark items as purchased (in_cart = false, interaction_type = 'purchased')
      for (const item of addedItems) {
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/session_items?id=eq.${item.id}`, {
            method: "PATCH",
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({ in_cart: false, interaction_type: "purchased" }),
          });
        } catch { /* continue */ }
      }
    }

    // Update local state immediately
    setSessionItems((prev) =>
      prev.map((i) =>
        addedItems.some((a) => a.id === i.id)
          ? { ...i, in_cart: false, interaction_type: "purchased" }
          : i
      )
    );
    chrome.storage.local.set({ cartify_session_updated_at: Date.now() });

    const domains = [...new Set(addedItems.map((i) => i.retailer_domain).filter(Boolean))];
    const domainText = domains.length === 1 ? domains[0] : `${domains.length} stores`;
    setShareToast(`Items added to ${domainText} cart — session cleared`);
    setTimeout(() => setShareToast(null), 3000);

    // Reload to reflect changes
    setTimeout(() => loadSessionItems(false), 800);
  };

  // ── Dimensions ──
  const containerClass = mode === "popup"
    ? "w-[380px] h-[560px] flex flex-col overflow-hidden"
    : "w-full h-screen flex flex-col overflow-hidden";

  // ── LOADING ──
  if (loading) {
    return (
      <div className={containerClass + " items-center justify-center"}>
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  // ── LOGGED OUT ──
  if (!user) {
    return (
      <div className={containerClass.replace("flex flex-col overflow-hidden", "flex flex-col justify-between p-8")}>
        <div className="space-y-1 pt-12 text-center">
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">Cartify</h1>
          <p className="text-[14px] text-muted-foreground">Try before you buy</p>
        </div>

        <div className="space-y-3">
          {authLoading ? (
            <div className="flex flex-col items-center space-y-4 py-2">
              <div className="relative h-10 w-10">
                <div className="absolute inset-0 rounded-full border-2 border-muted" />
                <div className="absolute inset-0 rounded-full border-2 border-t-foreground animate-spin" />
              </div>
              <div className="space-y-1 text-center">
                <p className="text-[14px] font-medium text-foreground">Signing in…</p>
                <p className="text-[11px] text-muted-foreground">Complete sign-in in the browser tab</p>
              </div>
              <button
                onClick={() => setAuthLoading(false)}
                className="text-[12px] text-muted-foreground/70 underline underline-offset-2 transition-colors hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => handleOAuth("google")}
                className="w-full rounded-xl bg-foreground py-3.5 text-[14px] font-medium text-background transition-opacity hover:opacity-80"
              >
                Continue with Google
              </button>
              <button
                onClick={() => handleOAuth("apple")}
                className="w-full rounded-xl border border-border bg-background py-3.5 text-[14px] font-medium text-foreground transition-opacity hover:opacity-80"
              >
                Continue with Apple
              </button>
            </>
          )}
        </div>

        <div className="pb-2 text-center">
          <span className="text-[11px] text-muted-foreground/60">Privacy Policy & Terms</span>
        </div>
      </div>
    );
  }

  // ── LOGGED IN ──
  const displayName = storedUser?.name || "User";
  const email = storedUser?.email || "";
  const avatarUrl = storedUser?.avatar_url;
  const initial = displayName.charAt(0).toUpperCase();

  const completedResults = results.filter((r) => r.result_image_url);
  const pendingResults = results.filter((r) => !r.result_image_url);

  const cartItems = sessionItems.filter((i) => i.in_cart);

  const parsePriceValue = (rawValue: string | null | undefined): number | null => {
    if (!rawValue) return null;

    const value = rawValue.replace(/\u00A0/g, " ").trim();
    const matches = value.match(/(?:\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/g);
    if (!matches?.length) return null;

    let normalized = matches.sort((a, b) => b.length - a.length)[0].replace(/\s/g, "");
    const hasComma = normalized.includes(",");
    const hasDot = normalized.includes(".");

    if (hasComma && hasDot) {
      if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
        normalized = normalized.replace(/\./g, "").replace(",", ".");
      } else {
        normalized = normalized.replace(/,/g, "");
      }
    } else if (hasComma) {
      const [, fraction = ""] = normalized.split(",");
      normalized = fraction.length === 2
        ? normalized.replace(/\./g, "").replace(",", ".")
        : normalized.replace(/,/g, "");
    } else if ((normalized.match(/\./g) || []).length > 1) {
      normalized = normalized.replace(/\./g, "");
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const sessionTotal = sessionItems.reduce((sum, i) => {
    const num = parsePriceValue(i.product_price);
    return num === null ? sum : sum + num;
  }, 0);
  const cartTotal = cartItems.reduce((sum, i) => {
    const num = parsePriceValue(i.product_price);
    return num === null ? sum : sum + num;
  }, 0);
  const itemsMissingPrice = sessionItems.filter((i) => !parsePriceValue(i.product_price)).length;

  // Detect currency symbol/prefix from first priced item
  const currencySymbol = (() => {
    const priced = sessionItems.find((i) => i.product_price);
    if (!priced?.product_price) return "$";
    // Match currency symbols or currency codes (kr, SEK, EUR, USD, etc.)
    const codePrefix = priced.product_price.match(/^\s*(kr|sek|eur|usd|gbp|dkk|nok|cad|aud)\b/i);
    if (codePrefix) return codePrefix[1].toUpperCase() + " ";
    const symbolMatch = priced.product_price.match(/^\s*[\$€£¥₹]/);
    if (symbolMatch) return symbolMatch[0].trim();
    const codeMatch = priced.product_price.match(/\b(kr|sek|eur|usd|gbp|dkk|nok|cad|aud)\b/i);
    if (codeMatch) return codeMatch[1].toUpperCase() + " ";
    const trailingSymbol = priced.product_price.match(/[\$€£¥₹]/);
    if (trailingSymbol) return trailingSymbol[0];
    return "$";
  })();




  return (
    <div className={containerClass + " relative"}>
      {/* Share toast */}
      {shareToast && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-foreground px-4 py-2 text-[12px] font-medium text-background shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          {shareToast}
        </div>
      )}
      {/* ── Fixed header ── */}
      <div className="shrink-0 px-5 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-[13px] font-medium text-muted-foreground">{initial}</span>
              )}
            </div>
            <div>
              <p className="text-[14px] font-medium text-foreground leading-tight">{displayName}</p>
              <p className="text-[11px] text-muted-foreground">{email}</p>
            </div>
          </div>
          <button
            onClick={() => setScreen("settings")}
            className="text-muted-foreground text-[16px] px-2 py-1 rounded-lg hover:bg-secondary hover:text-foreground transition-colors"
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </div>



      {/* ── Fixed sub-header ── */}
      {screen === "session" ? (
        <div className="shrink-0 px-5 pb-2 pt-1 flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-semibold tracking-tight text-foreground">Shopping Session</h2>
            <p className="text-[11px] text-muted-foreground">Products you've interacted with today</p>
          </div>
          <div className="flex items-center gap-1">
            {sessionDirty && (
              <button
                onClick={() => { setSessionDirty(false); void loadSessionItems(true); }}
                className="text-muted-foreground text-[14px] px-2 py-1 rounded-lg hover:bg-secondary hover:text-foreground transition-colors"
                title="Undo changes"
              >
                ←
              </button>
            )}
            <button
              onClick={() => { void loadSessionItems(true); }}
              className="text-muted-foreground text-[14px] px-2 py-1 rounded-lg hover:bg-secondary hover:text-foreground transition-colors"
              title="Refresh"
            >
              ↻
            </button>
          </div>
        </div>
      ) : screen === "profile" ? (
        <div className="shrink-0 px-5 pb-2">
          <p className="text-[11px] text-muted-foreground">Your photos for virtual try-on</p>
        </div>
      ) : screen === "showroom" ? (
        <div className="shrink-0 px-5 pb-2 pt-1 text-center">
          <h2 className="text-[20px] font-semibold tracking-tight text-foreground">Showroom</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">Today's try-ons · resets daily</p>
        </div>
      ) : (
        <div className="shrink-0 px-5 pb-2 pt-1">
          <h2 className="text-[16px] font-semibold tracking-tight text-foreground">Settings</h2>
        </div>
      )}

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto px-5 pb-3 scrollbar-hide">
        {screen === "session" ? (
          /* ── SESSION CONTENT ── */
          <div className="py-2">
            {/* Coupon banner */}
            {activeCoupons.length > 0 && (() => {
              // Calculate potential savings
              const domainEntries = Object.entries(filteredCouponsByDomain).filter(([, coupons]) => coupons.length > 0);
              const cartByDomain: Record<string, number> = {};
              cartItems.forEach((item) => {
                const domain = item.retailer_domain || "unknown";
                const price = parsePriceValue(item.product_price);
                if (price) cartByDomain[domain] = (cartByDomain[domain] || 0) + price;
              });

              let totalSavings = 0;
              let freeShippingCount = 0;
              for (const [domain, coupons] of domainEntries) {
                const subtotal = cartByDomain[domain] || 0;
                let bestDiscount = 0;
                for (const c of coupons) {
                  const isFreeShipping = /free.?ship|gratis.?frakt|livraison.?gratuite/i.test(c.description || "");
                  if (isFreeShipping) { freeShippingCount++; continue; }
                  const val = parseFloat(c.discount_value || "0");
                  if (!val) continue;
                  if (c.discount_type === "percentage") {
                    bestDiscount = Math.max(bestDiscount, subtotal * val / 100);
                  } else {
                    bestDiscount = Math.max(bestDiscount, val);
                  }
                }
                totalSavings += bestDiscount;
              }

              return (
                <div className="mb-3 rounded-xl border border-border bg-secondary/40 p-3">
                  <button
                    onClick={() => setCouponsExpanded(!couponsExpanded)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[14px]">🏷</span>
                      <p className="text-[12px] font-medium text-foreground">
                        {activeCoupons.length} deal{activeCoupons.length !== 1 ? "s" : ""} available
                      </p>
                    </div>
                    <span className="text-[11px] text-muted-foreground">{couponsExpanded ? "▲" : "▼"}</span>
                  </button>
                  {/* Potential savings summary */}
                  {(totalSavings > 0 || freeShippingCount > 0) && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <p className="text-[10px] text-green-600 font-medium">
                        💰 Potential savings: {totalSavings > 0 ? `${currencySymbol}${totalSavings.toFixed(2)}` : ""}
                        {totalSavings > 0 && freeShippingCount > 0 ? " + " : ""}
                        {freeShippingCount > 0 ? `${freeShippingCount} free shipping` : ""}
                      </p>
                    </div>
                  )}
                  {couponsExpanded && (
                    <div className="mt-2 space-y-3">
                      {domainEntries.map(([domain, coupons]) => (
                        <div key={domain}>
                          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{domain}</p>
                          <div className="space-y-1.5">
                            {coupons.map((c: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between rounded-lg bg-background p-2.5 border border-border">
                                <div>
                                  <p className="text-[11px] font-medium text-foreground">{c.description || `${c.discount_value || ""} off`}</p>
                                  {c.min_purchase && <p className="text-[9px] text-muted-foreground">Min. {c.min_purchase}</p>}
                                </div>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(c.code).catch(() => {});
                                    setShareToast(`${c.code} copied!`);
                                    setTimeout(() => setShareToast(null), 2000);
                                  }}
                                  className="rounded-lg bg-foreground px-3 py-1.5 text-[10px] font-bold text-background tracking-wider transition-opacity hover:opacity-80"
                                >
                                  {c.code}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      <p className="text-[9px] text-muted-foreground italic text-center">
                        Best discount auto-selected per store. Free shipping often combines with discount codes.
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}

            {sessionLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="aspect-[3/4] rounded-xl bg-secondary animate-pulse" />
                ))}
              </div>
            ) : sessionItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
                  <span className="text-[20px] text-muted-foreground">—</span>
                </div>
                <p className="mt-3 text-[13px] font-medium text-foreground">No activity yet</p>
                <p className="mt-1 max-w-[220px] text-[11px] leading-relaxed text-muted-foreground">
                  Browse any store and try on or save products — they'll appear here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {sessionItems.map((item) => (
                  <div key={item.id} className="group relative cursor-pointer" onClick={() => window.open(item.product_url, "_blank")}>
                    {/* Product image */}
                    {item.product_image ? (
                      <img
                        src={item.product_image}
                        alt={item.product_title || "Product"}
                        className="aspect-[3/4] w-full rounded-xl object-cover bg-secondary"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex aspect-[3/4] w-full items-center justify-center rounded-xl bg-secondary">
                        <span className="text-[24px] text-muted-foreground/40">—</span>
                      </div>
                    )}

                    {/* Hover overlay — 3 icon buttons */}
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-foreground/0 opacity-0 transition-all duration-200 group-hover:bg-foreground/40 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-3">
                        {/* Try On (hanger) */}
                        <button
                          onClick={() => handleTryOnSessionItem(item)}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md transition-transform hover:scale-110"
                          title="Try On"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2a3 3 0 0 0-3 3c0 1.5 1.5 3 3 3s3-1.5 3-3a3 3 0 0 0-3-3z"/>
                            <path d="M2 20l4-4c1.5-1.5 3.5-2 5.5-2h1c2 0 4 .5 5.5 2l4 4"/>
                          </svg>
                        </button>
                        {/* Remove / Toggle cart (trash or minus) */}
                        <button
                          onClick={() => item.in_cart ? handleToggleCart(item) : handleRemoveSessionItem(item)}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md transition-transform hover:scale-110"
                          title={item.in_cart ? "Remove from Cart" : "Remove"}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                        </button>
                        {/* Expand (maximize) */}
                        <button
                          onClick={() => item.product_image && setLightboxImage(item.product_image)}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md transition-transform hover:scale-110"
                          title="Enlarge"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Product info */}
                    <div className="mt-1.5 px-0.5">
                      <p className="truncate text-[11px] font-medium text-foreground">
                        {item.product_title || "Product"}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {item.product_price && (
                          <span className="text-[11px] font-semibold text-foreground">{item.product_price}</span>
                        )}
                        {item.retailer_domain && (
                          <span className="text-[10px] text-muted-foreground/50">{item.retailer_domain}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : screen === "profile" ? (
          <div className="space-y-5 pt-1">
            {CATEGORY_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group.label}</p>
                <div className="grid grid-cols-2 gap-3">
                  {group.categories.map((cat) => {
                    const photo = photos.find((p) => p.category === cat.key);
                    return (
                      <div key={cat.key} className="group relative">
                        {photosLoading ? (
                          <div className="aspect-square rounded-xl bg-secondary animate-pulse" />
                        ) : photo?.signedUrl ? (
                          <div className="relative">
                            <img
                              src={photo.signedUrl}
                              alt={cat.label}
                              className="aspect-square w-full rounded-xl object-cover"
                            />
                            <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-xl bg-foreground/0 opacity-0 transition-all group-hover:bg-foreground/40 group-hover:opacity-100">
                              <label className="cursor-pointer rounded-lg bg-background/90 px-3 py-1.5 text-[11px] font-medium text-foreground transition-opacity hover:opacity-80">
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) =>
                                    e.target.files?.[0] && handleUpload(cat.key, e.target.files[0])
                                  }
                                />
                                Replace
                              </label>
                              <button
                                onClick={() => handleDeletePhoto(photo)}
                                className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-background transition-opacity hover:opacity-80 bg-destructive"
                              >
                                Delete
                              </button>
                            </div>
                            <p className="mt-1.5 text-center text-[11px] font-medium text-muted-foreground">
                              {cat.label}
                            </p>
                          </div>
                        ) : (
                          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background text-muted-foreground transition-colors hover:bg-secondary/50">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) =>
                                e.target.files?.[0] && handleUpload(cat.key, e.target.files[0])
                              }
                            />
                            {uploading === cat.key ? (
                              <span className="text-[12px]">Uploading…</span>
                            ) : (
                              <>
                                <span className="text-[18px] leading-none">+</span>
                                <span className="mt-1 text-[11px] font-medium">{cat.label}</span>
                              </>
                            )}
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : screen === "showroom" ? (
          /* ── SHOWROOM CONTENT ── */
          <div className="py-3">
            {resultsLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="aspect-[3/4] rounded-xl bg-secondary animate-pulse" />
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
                  <span className="text-[20px] text-muted-foreground">—</span>
                </div>
                <p className="mt-3 text-[13px] font-medium text-foreground">Nothing here yet</p>
                <p className="mt-1 max-w-[220px] text-[11px] leading-relaxed text-muted-foreground">
                  Browse any online store and try products on yourself.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {completedResults.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    {completedResults.map((r) => (
                      <div key={r.id} className="group relative">
                        <img
                          src={r.result_image_url!}
                          alt={r.title || "Try-on result"}
                          className="aspect-[3/4] w-full rounded-xl object-cover"
                          loading="lazy"
                        />
                        {/* Hover overlay */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-foreground/0 opacity-0 transition-all duration-200 group-hover:bg-foreground/50 group-hover:opacity-100">
                          <button
                            onClick={() => handleAddToRetailerCart(r.page_url, r.retailer_domain)}
                            className="w-[80%] rounded-lg bg-background/95 py-2 text-center text-[11px] font-medium text-foreground shadow-sm transition-opacity hover:opacity-90 no-underline"
                          >
                            Add to Cart
                          </button>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDownload(r)}
                              title="Download"
                              className="flex items-center justify-center rounded-lg bg-background/95 px-3 py-2 text-foreground shadow-sm transition-opacity hover:opacity-90"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            </button>
                            <button
                              onClick={() => handleShare(r)}
                              title="Share"
                              className="flex items-center justify-center rounded-lg bg-background/95 px-3 py-2 text-foreground shadow-sm transition-opacity hover:opacity-90"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                            </button>
                          </div>
                        </div>
                        {(r.title || r.price) && (
                          <div className="mt-1.5 px-0.5">
                            {r.title && (
                              <p className="truncate text-[11px] font-medium text-foreground">
                                {r.title}
                              </p>
                            )}
                            <div className="flex items-center gap-1.5">
                              {r.price && (
                                <span className="text-[10px] text-muted-foreground">{r.price}</span>
                              )}
                              {r.retailer_domain && (
                                <span className="text-[10px] text-muted-foreground/50">
                                  {r.retailer_domain}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {pendingResults.length > 0 && (
                  <div>
                    <p className="mb-3 text-[11px] font-medium text-muted-foreground">
                      Processing
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {pendingResults.map((r) => (
                        <div key={r.id} className="relative">
                          <img
                            src={r.image_url}
                            alt={r.title || "Processing"}
                            className="aspect-[3/4] w-full rounded-xl object-cover opacity-50"
                            loading="lazy"
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
        ) : (
          /* ── SETTINGS CONTENT ── */
          <div className="py-3 space-y-6">
            <div>
              <p className="text-[12px] font-medium text-foreground mb-3">Display mode</p>
              <div className="space-y-2">
                <label className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${displayMode === "popup" ? "border-foreground bg-secondary" : "border-border hover:bg-secondary/50"}`}>
                  <input
                    type="radio"
                    name="displayMode"
                    checked={displayMode === "popup"}
                    onChange={() => handleDisplayModeChange("popup")}
                    className="accent-foreground"
                  />
                  <div>
                    <p className="text-[13px] font-medium text-foreground">Popup</p>
                    <p className="text-[11px] text-muted-foreground">Opens as a small popup window</p>
                  </div>
                </label>
                <label className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${displayMode === "sidepanel" ? "border-foreground bg-secondary" : "border-border hover:bg-secondary/50"}`}>
                  <input
                    type="radio"
                    name="displayMode"
                    checked={displayMode === "sidepanel"}
                    onChange={() => handleDisplayModeChange("sidepanel")}
                    className="accent-foreground"
                  />
                  <div>
                    <p className="text-[13px] font-medium text-foreground">Side Panel</p>
                    <p className="text-[11px] text-muted-foreground">Opens as a browser side panel</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="border-t pt-4">
              <button
                onClick={handleSignOut}
                className="w-full rounded-xl border border-border bg-background py-3 text-[13px] font-medium text-foreground transition-opacity hover:opacity-80"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Session summary bar (compact) ── */}
      {screen === "session" && sessionItems.length > 0 && (
        <div className="shrink-0 border-t border-border bg-background px-4 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {sessionItems.length} item{sessionItems.length !== 1 ? "s" : ""}
              {cartItems.length > 0 && ` · ${cartItems.length} in cart`}
            </span>
            {cartTotal > 0 ? (
              <span className="text-[11px] font-semibold text-foreground">
                {currencySymbol}{cartTotal.toFixed(2)}
              </span>
            ) : sessionTotal > 0 ? (
              <span className="text-[11px] font-semibold text-foreground">
                {currencySymbol}{sessionTotal.toFixed(2)}
              </span>
            ) : null}
          </div>
          {cartItems.length > 0 && (
            <button
              onClick={startVariantFlow}
              className="mt-1.5 w-full rounded-lg bg-foreground py-1.5 text-[10px] font-medium text-background transition-opacity hover:opacity-80"
            >
              Add to cart
            </button>
          )}
        </div>
      )}

      {/* ── Fixed bottom nav (icons only) ── */}
      <div className="shrink-0 border-t border-border">
        <nav className="flex items-center justify-around px-2 py-2">
          {/* Session — clock icon */}
          <button
            onClick={() => setScreen("session")}
            className={`p-2 transition-colors ${screen === "session" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            title="Session"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </button>
          {/* Showroom — grid icon */}
          <button
            onClick={() => setScreen("showroom")}
            className={`p-2 transition-colors ${screen === "showroom" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            title="Showroom"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
          </button>
          {/* Profile — user icon */}
          <button
            onClick={() => setScreen("profile")}
            className={`p-2 transition-colors ${screen === "profile" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            title="Profile"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </button>
        </nav>
      </div>

      {/* ── Variant Selection Flow ── */}
      {variantFlow && variantFlow[variantFlowIndex] && (() => {
        const currentItem = variantFlow[variantFlowIndex];
        const sel = variantSelections[currentItem.id] || { size: "", color: "" };
        const ev = extractedVariants[currentItem.id];
        const hasSizes = ev && ev.sizes.length > 0;
        const hasColors = ev && ev.colors.length > 0;
        return (
          <div className="absolute inset-0 z-50 flex flex-col bg-background">
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-2">
              <p className="text-[12px] font-medium text-muted-foreground">
                {variantFlowIndex + 1} of {variantFlow.length}
              </p>
              <button
                onClick={() => setVariantFlow(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <div className="flex gap-3 mb-4">
                {currentItem.product_image ? (
                  <img src={currentItem.product_image} alt="" className="h-24 w-20 rounded-lg object-cover bg-secondary shrink-0" />
                ) : (
                  <div className="h-24 w-20 rounded-lg bg-secondary shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-foreground line-clamp-2">{currentItem.product_title || "Product"}</p>
                  {currentItem.product_price && <p className="text-[11px] font-semibold text-foreground mt-0.5">{currentItem.product_price}</p>}
                  {currentItem.retailer_domain && <p className="text-[10px] text-muted-foreground mt-0.5">{currentItem.retailer_domain}</p>}
                </div>
              </div>

              {variantsLoading && (
                <p className="text-[10px] text-muted-foreground mb-2 animate-pulse">Detecting available options…</p>
              )}

              <div className="space-y-3">
                {/* Size */}
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Size</label>
                  {hasSizes ? (
                    <div className="flex flex-wrap gap-1.5">
                      {ev.sizes.map((s) => (
                        <button
                          key={s}
                          onClick={() => setVariantSelections((prev) => ({ ...prev, [currentItem.id]: { ...sel, size: sel.size === s ? "" : s } }))}
                          className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                            sel.size === s
                              ? "border-foreground bg-foreground text-background"
                              : "border-border text-foreground hover:bg-secondary"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  ) : !variantsLoading ? (
                    <p className="text-[10px] text-muted-foreground/60 italic">No size options detected</p>
                  ) : null}
                </div>
                {/* Color */}
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Color / Variant</label>
                  {hasColors ? (
                    <div className="flex flex-wrap gap-1.5">
                      {ev.colors.map((c) => (
                        <button
                          key={c}
                          onClick={() => setVariantSelections((prev) => ({ ...prev, [currentItem.id]: { ...sel, color: sel.color === c ? "" : c } }))}
                          className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                            sel.color === c
                              ? "border-foreground bg-foreground text-background"
                              : "border-border text-foreground hover:bg-secondary"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  ) : !variantsLoading ? (
                    <p className="text-[10px] text-muted-foreground/60 italic">No color options detected</p>
                  ) : null}
                </div>
              </div>
            </div>
            {/* Footer */}
            <div className="shrink-0 px-4 pb-4">
              {(() => {
                const hasVariantOptions = hasSizes || hasColors;
                const hasSelection = !!(sel.size || sel.color);
                const canProceed = !hasVariantOptions || hasSelection;
                return (
                  <>
                    {hasVariantOptions && !hasSelection && !variantsLoading && (
                      <p className="text-[10px] text-muted-foreground mb-2 text-center">Select size and/or color to continue</p>
                    )}
                    <button
                      onClick={handleVariantNext}
                      disabled={!canProceed || variantsLoading}
                      className={`w-full rounded-lg py-2.5 text-[12px] font-medium transition-opacity ${
                        canProceed && !variantsLoading
                          ? "bg-foreground text-background hover:opacity-80"
                          : "bg-muted text-muted-foreground cursor-not-allowed"
                      }`}
                    >
                      {variantFlowIndex < variantFlow.length - 1 ? "Next" : "Add to cart"}
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        );
      })()}

      {/* ── Image Lightbox ── */}
      {lightboxImage && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-foreground/80 backdrop-blur-sm"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-h-[90%] max-w-[90%]" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxImage} alt="Product" className="max-h-[80vh] rounded-xl object-contain shadow-2xl" />
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-3 -right-3 flex h-7 w-7 items-center justify-center rounded-full bg-background text-foreground shadow-md transition-transform hover:scale-110"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
