import React, { useEffect, useState } from "react";
import { signInWithOAuth, signOut, getStoredUser } from "@ext/lib/auth";

const APP_URL = import.meta.env.VITE_APP_URL || "https://ddsasdkse.lovable.app";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

type Screen = "profile" | "showroom";

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

const CATEGORY_GROUPS = [
  {
    key: "you",
    label: "You",
    categories: [
      { key: "full_body", label: "Full Body" },
      { key: "upper_body", label: "Upper Body" },
      { key: "face", label: "Face" },
      { key: "hands", label: "Hands" },
      { key: "fingers", label: "Fingers" },
      { key: "nails", label: "Nails" },
      { key: "hair", label: "Hair" },
      { key: "ears", label: "Ears" },
    ],
  },
  {
    key: "home",
    label: "Home",
    categories: [
      { key: "living_room", label: "Living Room" },
      { key: "kitchen", label: "Kitchen" },
      { key: "bedroom", label: "Bedroom" },
      { key: "bathroom", label: "Bathroom" },
      { key: "office", label: "Office" },
    ],
  },
  {
    key: "pets",
    label: "Pets",
    categories: [
      { key: "dog", label: "Dog" },
      { key: "cat", label: "Cat" },
    ],
  },
  {
    key: "vehicle",
    label: "Vehicle",
    categories: [
      { key: "car_interior", label: "Car Interior" },
      { key: "car_exterior", label: "Car Exterior" },
    ],
  },
  {
    key: "garden",
    label: "Garden",
    categories: [
      { key: "patio", label: "Patio" },
      { key: "garden", label: "Garden" },
      { key: "balcony", label: "Balcony" },
    ],
  },
];

export function Popup() {
  const [user, setUser] = useState<User | null>(null);
  const [storedUser, setStoredUser] = useState<StoredUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [_authError, _setAuthError] = useState(""); // unused, kept for compat
  const [screen, setScreen] = useState<Screen>("profile");

  // Try-on state
  const [results, setResults] = useState<TryonResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);

  // Profile photo state
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("you");

  // Initialize auth — check chrome.storage for existing session
  useEffect(() => {
    chrome.storage.local.get(["vto_auth_token", "vto_user"], (result) => {
      if (result.vto_auth_token && result.vto_user) {
        setStoredUser(result.vto_user);
        // Set a minimal user object so the popup shows logged-in state
        setUser({ id: result.vto_user.id } as any);
      }
      setLoading(false);
    });

    // Listen for session arriving from web app content script
    const listener = (
      changes: Record<string, { oldValue?: any; newValue?: any }>,
      area: string
    ) => {
      if (area !== "local") return;
      if (changes.vto_auth_token?.newValue && changes.vto_user?.newValue) {
        const u = changes.vto_user.newValue;
        setStoredUser(u);
        setUser({ id: u.id } as any);
        setAuthLoading(false);
      }
      if (changes.vto_auth_token && !changes.vto_auth_token.newValue) {
        // Logged out
        setUser(null);
        setStoredUser(null);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  // Load try-on results when on showroom — use auth token for direct fetch
  useEffect(() => {
    if (!storedUser || screen !== "showroom") return;
    setResultsLoading(true);

    chrome.storage.local.get("vto_auth_token", async (result) => {
      const token = result.vto_auth_token;
      if (!token) { setResultsLoading(false); return; }

      try {
        const SUPABASE_API_URL = import.meta.env.VITE_SUPABASE_URL as string;
        const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
        const res = await fetch(
          `${SUPABASE_API_URL}/rest/v1/tryon_requests?user_id=eq.${storedUser.id}&order=created_at.desc`,
          {
            headers: {
              apikey: ANON_KEY,
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

  // Load profile photos when on profile — use auth token for direct fetch
  useEffect(() => {
    if (!storedUser || screen !== "profile") return;
    setPhotosLoading(true);

    chrome.storage.local.get("vto_auth_token", async (result) => {
      const token = result.vto_auth_token;
      if (!token) { setPhotosLoading(false); return; }

      try {
        const SUPABASE_API_URL = import.meta.env.VITE_SUPABASE_URL as string;
        const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
        const res = await fetch(
          `${SUPABASE_API_URL}/rest/v1/profile_photos?user_id=eq.${storedUser.id}`,
          {
            headers: {
              apikey: ANON_KEY,
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const data = await res.json();
        if (Array.isArray(data)) {
          // Generate signed URLs for each photo
          const withUrls = await Promise.all(
            data.map(async (p: any) => {
              const signRes = await fetch(
                `${SUPABASE_API_URL}/storage/v1/object/sign/profile-photos/${p.storage_path}`,
                {
                  method: "POST",
                  headers: {
                    apikey: ANON_KEY,
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
                  ? `${SUPABASE_API_URL}/storage/v1${signData.signedURL}`
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
    // Opens web app login in a new tab — session syncs back via content script
    await signInWithOAuth(provider);
    // Popup stays in "Completing sign-in…" state until chrome.storage updates
  };

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
    setStoredUser(null);
    setResults([]);
    setPhotos([]);
  };

  const handleUpload = async (category: string, file: File) => {
    if (!storedUser) return;
    setUploading(category);

    const stored = await chrome.storage.local.get("vto_auth_token");
    const token = stored.vto_auth_token;
    if (!token) { setUploading(null); return; }

    const SUPABASE_API_URL = import.meta.env.VITE_SUPABASE_URL as string;
    const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
    const filePath = `${storedUser.id}/${category}-${Date.now()}`;
    const headers = { apikey: ANON_KEY, Authorization: `Bearer ${token}` };

    // Delete existing
    const existing = photos.find((p) => p.category === category);
    if (existing) {
      await fetch(`${SUPABASE_API_URL}/storage/v1/object/profile-photos/${existing.storage_path}`, {
        method: "DELETE", headers,
      });
      await fetch(`${SUPABASE_API_URL}/rest/v1/profile_photos?id=eq.${existing.id}`, {
        method: "DELETE", headers,
      });
    }

    // Upload
    const uploadRes = await fetch(`${SUPABASE_API_URL}/storage/v1/object/profile-photos/${filePath}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": file.type },
      body: file,
    });
    if (!uploadRes.ok) { setUploading(null); return; }

    // Insert record
    await fetch(`${SUPABASE_API_URL}/rest/v1/profile_photos`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: storedUser.id, category, storage_path: filePath }),
    });

    setUploading(null);
    // Trigger photo reload
    setPhotosLoading(true);
    setScreen("profile");
  };

  const handleDeletePhoto = async (photo: PhotoRecord) => {
    const stored = await chrome.storage.local.get("vto_auth_token");
    const token = stored.vto_auth_token;
    if (!token) return;

    const SUPABASE_API_URL = import.meta.env.VITE_SUPABASE_URL as string;
    const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
    const headers = { apikey: ANON_KEY, Authorization: `Bearer ${token}` };

    await fetch(`${SUPABASE_API_URL}/storage/v1/object/profile-photos/${photo.storage_path}`, {
      method: "DELETE", headers,
    });
    await fetch(`${SUPABASE_API_URL}/rest/v1/profile_photos?id=eq.${photo.id}`, {
      method: "DELETE", headers,
    });
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  };

  // ── LOADING ──
  if (loading) {
    return (
      <div className="w-[380px] min-h-[420px] p-5 flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  // ── LOGGED OUT: OAuth Screen ──
  if (!user) {
    return (
      <div className="w-[380px] min-h-[480px] p-8 flex flex-col justify-between">
        {/* Header */}
        <div className="space-y-1 pt-12 text-center">
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">VTO</h1>
          <p className="text-[14px] text-muted-foreground">Try before you buy</p>
        </div>

        {/* OAuth buttons */}
        <div className="space-y-3">
          {authLoading ? (
            <div className="text-center space-y-2">
              <p className="text-[14px] font-medium text-foreground">Completing sign-in…</p>
              <p className="text-[12px] text-muted-foreground">
                Sign in on the tab that just opened, then come back here.
              </p>
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

        {/* Footer */}
        <div className="pb-2 text-center">
          <span className="text-[11px] text-muted-foreground/60">Privacy Policy & Terms</span>
        </div>
      </div>
    );
  }

  // ── LOGGED IN ──
  const displayName =
    storedUser?.name || "User";
  const email = storedUser?.email || "";
  const avatarUrl = storedUser?.avatar_url;
  const initial = displayName.charAt(0).toUpperCase();

  const completedResults = results.filter((r) => r.result_image_url);
  const pendingResults = results.filter((r) => !r.result_image_url);

  const getAffiliateUrl = (r: TryonResult) =>
    `${SUPABASE_URL}/functions/v1/redirect?target=${encodeURIComponent(r.page_url)}&retailerDomain=${r.retailer_domain ?? ""}`;

  const activeGroup = CATEGORY_GROUPS.find((g) => g.key === activeTab) || CATEGORY_GROUPS[0];

  return (
    <div className="w-[380px] min-h-[480px] flex flex-col">
      {/* Settings gear + sign out */}
      <div className="flex items-center justify-end px-3 pt-3">
        <button
          onClick={handleSignOut}
          className="text-muted-foreground text-[11px] font-medium px-2 py-1 rounded hover:bg-secondary hover:text-foreground transition-colors"
        >
          Sign Out
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-5 pb-2">
        {screen === "profile" ? (
          /* ── PROFILE SCREEN ── */
          <div className="flex flex-col">
            {/* Avatar + info */}
            <div className="flex flex-col items-center pt-2 text-center">
              <div className="h-14 w-14 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[15px] font-medium text-muted-foreground">{initial}</span>
                )}
              </div>
              <p className="mt-3 text-[15px] font-medium text-foreground">{displayName}</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">{email}</p>
            </div>

            {/* Photo tabs */}
            <p className="text-center text-[12px] text-muted-foreground mt-4">
              Your photos for virtual try-on
            </p>

            {/* Tab buttons */}
            <div className="flex justify-center gap-1 mt-3 flex-wrap">
              {CATEGORY_GROUPS.map((group) => (
                <button
                  key={group.key}
                  onClick={() => setActiveTab(group.key)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                    activeTab === group.key
                      ? "bg-foreground text-background"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {group.label}
                </button>
              ))}
            </div>

            {/* Photo grid */}
            <div className="grid grid-cols-2 gap-3 pt-3 pb-4">
              {activeGroup.categories.map((cat) => {
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
                            className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-background transition-opacity hover:opacity-80"
                            style={{ background: "hsl(0 72% 51%)" }}
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
        ) : (
          /* ── SHOWROOM SCREEN ── */
          <div className="flex flex-col">
            <div className="pt-2 text-center">
              <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Showroom</h1>
              <p className="mt-1 text-[13px] text-muted-foreground">See how products look on you</p>
            </div>

            <div className="py-4">
              {resultsLoading ? (
                <div className="grid grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="aspect-[3/4] rounded-xl bg-secondary animate-pulse" />
                  ))}
                </div>
              ) : results.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-12">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
                    <span className="text-[24px] text-muted-foreground">—</span>
                  </div>
                  <p className="mt-4 text-[14px] font-medium text-foreground">Nothing here yet</p>
                  <p className="mt-1 max-w-[240px] text-[12px] leading-relaxed text-muted-foreground">
                    Browse any online store and try products on yourself — clothes, glasses, jewelry,
                    and more.
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
                          <a
                            href={getAffiliateUrl(r)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-[11px] font-medium text-background transition-opacity hover:opacity-90 no-underline"
                          >
                            Add to Cart
                          </a>
                        </div>
                      ))}
                    </div>
                  )}

                  {pendingResults.length > 0 && (
                    <div>
                      <p className="mb-3 text-[12px] font-medium text-muted-foreground">
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
          </div>
        )}
      </div>

      {/* Bottom tab bar */}
      <nav className="flex items-center justify-around border-t px-2 py-3" style={{ borderColor: "hsl(0 0% 92%)" }}>
        <button
          onClick={() => setScreen("profile")}
          className={`text-[13px] font-medium tracking-tight transition-opacity ${
            screen === "profile"
              ? "text-foreground opacity-100"
              : "text-muted-foreground opacity-60 hover:opacity-100"
          }`}
        >
          Profile
        </button>
        <button
          onClick={() => setScreen("showroom")}
          className={`text-[13px] font-medium tracking-tight transition-opacity ${
            screen === "showroom"
              ? "text-foreground opacity-100"
              : "text-muted-foreground opacity-60 hover:opacity-100"
          }`}
        >
          Showroom
        </button>
      </nav>

      {/* Disclosure */}
      <p className="text-[10px] text-muted-foreground/60 text-center pb-2">
        We may earn affiliate commission from purchases.
      </p>
    </div>
  );
}
