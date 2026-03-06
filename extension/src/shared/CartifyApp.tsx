import React, { useEffect, useState } from "react";
import { signInWithOAuth, signOut } from "@ext/lib/auth";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type Screen = "profile" | "showroom" | "settings";

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

interface PhotoRecord {
  id: string;
  category: string;
  storage_path: string;
  signedUrl?: string;
}

interface PendingProduct {
  product_url: string;
  product_title: string;
  product_image: string;
  product_category?: string;
}

const CATEGORIES = [
  { key: "full_body", label: "Full Body" },
  { key: "upper_body", label: "Upper Body" },
  { key: "face", label: "Face" },
  { key: "hands", label: "Hands" },
  { key: "fingers", label: "Fingers" },
  { key: "nails", label: "Nails" },
  { key: "hair", label: "Hair" },
  { key: "ears", label: "Ears" },
];

interface CartifyAppProps {
  mode: "popup" | "sidepanel";
}

export function CartifyApp({ mode }: CartifyAppProps) {
  const [user, setUser] = useState<any | null>(null);
  const [storedUser, setStoredUser] = useState<StoredUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [screen, setScreen] = useState<Screen>("profile");

  // Try-on state
  const [results, setResults] = useState<TryonResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);

  // Profile photo state
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  // Settings state
  const [displayMode, setDisplayMode] = useState<"popup" | "sidepanel">(mode);

  // Pending product from content script
  const [pendingProduct, setPendingProduct] = useState<PendingProduct | null>(null);

  // Initialize auth + pending product
  useEffect(() => {
    chrome.storage.local.get(
      ["cartify_auth_token", "cartify_user", "cartify_display_mode", "cartify_pending_product"],
      (result) => {
        if (result.cartify_auth_token && result.cartify_user) {
          setStoredUser(result.cartify_user);
          setUser({ id: result.cartify_user.id });
        }
        if (result.cartify_display_mode) {
          setDisplayMode(result.cartify_display_mode);
        }
        if (result.cartify_pending_product) {
          setPendingProduct(result.cartify_pending_product);
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
      if (changes.cartify_pending_product?.newValue) {
        setPendingProduct(changes.cartify_pending_product.newValue);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  // Load try-on results
  useEffect(() => {
    if (!storedUser || screen !== "showroom") return;
    setResultsLoading(true);

    chrome.storage.local.get("cartify_auth_token", async (result) => {
      const token = result.cartify_auth_token;
      if (!token) { setResultsLoading(false); return; }

      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/tryon_requests?user_id=eq.${storedUser.id}&order=created_at.desc`,
          {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      }
      setResultsLoading(false);
    });
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
    const result = await signInWithOAuth(provider);
    if (!result.ok) {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
    setStoredUser(null);
    setResults([]);
    setPhotos([]);
    setScreen("profile");
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
    // Notify background to dynamically toggle popup vs side panel behavior
    chrome.runtime.sendMessage({ type: "DISPLAY_MODE_CHANGED", mode: newMode });
  };

  const handleTryOnFromPanel = () => {
    if (!pendingProduct) return;
    chrome.runtime.sendMessage(
      { type: "CARTIFY_TRYON_REQUEST", payload: pendingProduct },
      (response) => {
        if (response?.ok) {
          setScreen("showroom");
        }
      }
    );
  };

  // ── Dimensions ──
  const containerClass = mode === "popup"
    ? "w-[380px] h-[560px] flex flex-col overflow-hidden"
    : "w-full h-full min-h-screen flex flex-col overflow-hidden";

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

  const getAffiliateUrl = (r: TryonResult) =>
    `${SUPABASE_URL}/functions/v1/redirect?target=${encodeURIComponent(r.page_url)}&retailerDomain=${r.retailer_domain ?? ""}`;

  return (
    <div className={containerClass}>
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

      {/* ── Pending product banner ── */}
      {pendingProduct && screen !== "settings" && (
        <div className="shrink-0 mx-5 mb-2 rounded-xl border border-border bg-secondary/50 p-3">
          <div className="flex items-center gap-3">
            <img
              src={pendingProduct.product_image}
              alt={pendingProduct.product_title}
              className="h-12 w-12 rounded-lg object-cover"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-foreground truncate">
                {pendingProduct.product_title}
              </p>
              <button
                onClick={handleTryOnFromPanel}
                className="mt-1 rounded-lg bg-foreground px-3 py-1 text-[11px] font-medium text-background transition-opacity hover:opacity-80"
              >
                Try On
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Fixed sub-header ── */}
      {screen === "profile" ? (
        <div className="shrink-0 px-5 pb-2">
          <p className="text-[11px] text-muted-foreground">Your photos for virtual try-on</p>
        </div>
      ) : screen === "showroom" ? (
        <div className="shrink-0 px-5 pb-2 pt-1 text-center">
          <h2 className="text-[20px] font-semibold tracking-tight text-foreground">Showroom</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">See how products look on you</p>
        </div>
      ) : (
        <div className="shrink-0 px-5 pb-2 pt-1">
          <h2 className="text-[16px] font-semibold tracking-tight text-foreground">Settings</h2>
        </div>
      )}

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto px-5 pb-3 scrollbar-hide">
        {screen === "profile" ? (
          <div className="grid grid-cols-2 gap-3 pt-1">
            {CATEGORIES.map((cat) => {
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
                        />
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
                        <a
                          href={getAffiliateUrl(r)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1.5 flex w-full items-center justify-center rounded-lg bg-foreground px-3 py-1.5 text-[11px] font-medium text-background transition-opacity hover:opacity-90 no-underline"
                        >
                          Add to Cart
                        </a>
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

      {/* ── Fixed bottom nav ── */}
      <div className="shrink-0 border-t">
        <nav className="flex items-center justify-around px-2 py-2.5">
          <button
            onClick={() => setScreen("profile")}
            className={`text-[12px] font-medium tracking-tight transition-colors ${
              screen === "profile"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setScreen("showroom")}
            className={`text-[12px] font-medium tracking-tight transition-colors ${
              screen === "showroom"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Showroom
          </button>
        </nav>
        <p className="text-[9px] text-muted-foreground/50 text-center pb-2">
          We may earn affiliate commission from purchases.
        </p>
      </div>
    </div>
  );
}
