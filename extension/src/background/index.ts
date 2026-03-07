/**
 * Background service worker — centralized auth manager + try-on requests + shopping sessions.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const WEB_APP_URL = "https://ddsasdkse.lovable.app";

const TOKEN_REFRESH_ALARM = "cartify_token_refresh";
const AUTH_TIMEOUT_ALARM = "cartify_auth_timeout";

let pendingAuthTabId: number | null = null;
let pendingAuthResolve: ((result: { ok: boolean; error?: string }) => void) | null = null;

// ── Alarm helper ──

async function ensureTokenRefreshAlarm() {
  const existing = await chrome.alarms.get(TOKEN_REFRESH_ALARM);
  if (!existing) {
    await chrome.alarms.create(TOKEN_REFRESH_ALARM, { periodInMinutes: 45 });
  }
}

ensureTokenRefreshAlarm().catch((e) =>
  console.warn("[Cartify] alarm init failed:", e)
);

// ── Auth helpers ──

async function doOAuthLogin(provider: "google" | "apple"): Promise<{ ok: boolean; error?: string }> {
  const authUrl = `${WEB_APP_URL}/auth/extension?provider=${provider}`;

  return new Promise((resolve) => {
    pendingAuthResolve = resolve;

    chrome.tabs.create({ url: authUrl, active: true }, (tab) => {
      if (chrome.runtime.lastError || !tab?.id) {
        pendingAuthResolve = null;
        resolve({ ok: false, error: chrome.runtime.lastError?.message || "Failed to open auth tab" });
        return;
      }
      pendingAuthTabId = tab.id;
      chrome.alarms.create(AUTH_TIMEOUT_ALARM, { delayInMinutes: 2 });
    });
  });
}

async function doLogout(): Promise<void> {
  await chrome.storage.local.remove([
    "cartify_auth_token",
    "cartify_refresh_token",
    "cartify_user",
    "cartify_last_result",
  ]);
}

async function getAuthState(): Promise<{ loggedIn: boolean; user: any | null }> {
  const result = await chrome.storage.local.get(["cartify_auth_token", "cartify_refresh_token", "cartify_user"]);
  if (!result.cartify_auth_token) {
    return { loggedIn: false, user: null };
  }

  // If token is expired, try to refresh before reporting auth state
  if (isTokenExpired(result.cartify_auth_token)) {
    if (result.cartify_refresh_token) {
      const refreshed = await refreshToken();
      if (!refreshed) {
        return { loggedIn: false, user: null };
      }
      const updated = await chrome.storage.local.get("cartify_user");
      return { loggedIn: true, user: updated.cartify_user || result.cartify_user || null };
    }
    return { loggedIn: false, user: null };
  }

  return { loggedIn: true, user: result.cartify_user || null };
}

async function refreshToken(): Promise<boolean> {
  const stored = await chrome.storage.local.get("cartify_refresh_token");
  const refreshTok = stored.cartify_refresh_token;
  if (!refreshTok) return false;

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshTok }),
    });

    if (!res.ok) {
      // Only clear auth on explicit auth rejection (400/401) — not on network/server errors
      if (res.status === 400 || res.status === 401) {
        await chrome.storage.local.remove(["cartify_auth_token", "cartify_refresh_token", "cartify_user"]);
      }
      return false;
    }

    const data = await res.json();
    if (!data.access_token) return false;

    const user = {
      id: data.user.id,
      email: data.user.email,
      name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || data.user.email,
      avatar_url: data.user.user_metadata?.avatar_url,
    };

    await chrome.storage.local.set({
      cartify_auth_token: data.access_token,
      cartify_refresh_token: data.refresh_token,
      cartify_user: user,
    });

    return true;
  } catch {
    return false;
  }
}

function completeAuth(result: { ok: boolean; error?: string }) {
  chrome.alarms.clear(AUTH_TIMEOUT_ALARM);
  chrome.storage.local.remove("cartify_auth_pending");
  if (pendingAuthTabId !== null) {
    try { chrome.tabs.remove(pendingAuthTabId); } catch {}
    pendingAuthTabId = null;
  }
  if (pendingAuthResolve) {
    pendingAuthResolve(result);
    pendingAuthResolve = null;
  }
}

// ── Display mode ──

async function applyDisplayMode(mode: "popup" | "sidepanel") {
  if (mode === "sidepanel") {
    const sidePanelSupported =
      !!(chrome.sidePanel && typeof (chrome.sidePanel as any).setPanelBehavior === "function");

    if (!sidePanelSupported) {
      await chrome.action.setPopup({ popup: "popup.html" });
      await chrome.storage.local.set({ cartify_display_mode: "popup" });
      return;
    }

    await chrome.action.setPopup({ popup: "" });
    try {
      await (chrome.sidePanel as any).setPanelBehavior({ openPanelOnActionClick: true });
    } catch (e) {
      await chrome.action.setPopup({ popup: "popup.html" });
      await chrome.storage.local.set({ cartify_display_mode: "popup" });
    }
  } else {
    await chrome.action.setPopup({ popup: "popup.html" });
    try {
      if (chrome.sidePanel && typeof (chrome.sidePanel as any).setPanelBehavior === "function") {
        await (chrome.sidePanel as any).setPanelBehavior({ openPanelOnActionClick: false });
      }
    } catch {}
  }
}

// ── JWT helpers ──

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    // Consider expired if less than 60s remaining
    return payload.exp * 1000 < Date.now() + 60_000;
  } catch {
    return true;
  }
}

// ── Shopping Session helpers ──

async function getAuthHeaders(): Promise<Record<string, string> | null> {
  const stored = await chrome.storage.local.get("cartify_auth_token");
  if (!stored.cartify_auth_token) return null;

  // Proactively refresh if token is expired or about to expire
  if (isTokenExpired(stored.cartify_auth_token)) {
    const refreshed = await refreshToken();
    if (!refreshed) return null;
    const updated = await chrome.storage.local.get("cartify_auth_token");
    if (!updated.cartify_auth_token) return null;
    return {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${updated.cartify_auth_token}`,
      "Content-Type": "application/json",
    };
  }

  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${stored.cartify_auth_token}`,
    "Content-Type": "application/json",
  };
}

/**
 * Fetch wrapper that retries once on 401/403 after refreshing the token.
 */
async function fetchWithAutoRefresh(
  url: string,
  init: RequestInit & { headers: Record<string, string> }
): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status === 401 || res.status === 403) {
    const refreshed = await refreshToken();
    if (!refreshed) return res;
    const updated = await chrome.storage.local.get("cartify_auth_token");
    if (!updated.cartify_auth_token) return res;
    const newHeaders = {
      ...init.headers,
      Authorization: `Bearer ${updated.cartify_auth_token}`,
    };
    return fetch(url, { ...init, headers: newHeaders });
  }
  return res;
}

async function ensureSession(): Promise<string | null> {
  const headers = await getAuthHeaders();
  if (!headers) return null;

  const stored = await chrome.storage.local.get("cartify_user");
  const userId = stored.cartify_user?.id;
  if (!userId) return null;

  try {
    // Check for existing active session that hasn't expired
    const res = await fetchWithAutoRefresh(
      `${SUPABASE_URL}/rest/v1/shopping_sessions?user_id=eq.${userId}&is_active=eq.true&expires_at=gt.${new Date().toISOString()}&order=started_at.desc&limit=1`,
      { headers }
    );
    const sessions = await res.json();

    if (Array.isArray(sessions) && sessions.length > 0) {
      return sessions[0].id;
    }

    // Deactivate any expired sessions still marked active
    await fetchWithAutoRefresh(
      `${SUPABASE_URL}/rest/v1/shopping_sessions?user_id=eq.${userId}&is_active=eq.true&expires_at=lte.${new Date().toISOString()}`,
      {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({ is_active: false }),
      }
    ).catch(() => {});

    // Create new session
    const createRes = await fetchWithAutoRefresh(`${SUPABASE_URL}/rest/v1/shopping_sessions`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({ user_id: userId }),
    });

    if (!createRes.ok) {
      console.error("[Cartify] ensureSession create failed:", createRes.status, await createRes.text());
      return null;
    }

    const created = await createRes.json();
    if (Array.isArray(created) && created.length > 0) {
      return created[0].id;
    }
    return null;
  } catch (e) {
    console.error("[Cartify] ensureSession error:", e);
    return null;
  }
}

async function addSessionItem(
  payload: any,
  interactionType: string,
  inCart: boolean = false,
  tryonRequestId?: string
): Promise<boolean> {
  const headers = await getAuthHeaders();
  if (!headers) return false;

  const stored = await chrome.storage.local.get("cartify_user");
  const userId = stored.cartify_user?.id;
  if (!userId) return false;

  const sessionId = await ensureSession();
  if (!sessionId) return false;

  try {
    // Check if item already exists in this session
    const checkRes = await fetchWithAutoRefresh(
      `${SUPABASE_URL}/rest/v1/session_items?session_id=eq.${sessionId}&product_url=eq.${encodeURIComponent(payload.product_url)}&limit=1`,
      { headers }
    );
    const existing = await checkRes.json();

    if (Array.isArray(existing) && existing.length > 0) {
      // Update existing item
      const updateBody: any = {
        interaction_type: interactionType,
        updated_at: new Date().toISOString(),
      };
      if (inCart) updateBody.in_cart = true;
      if (tryonRequestId) updateBody.tryon_request_id = tryonRequestId;

      const patchRes = await fetchWithAutoRefresh(
        `${SUPABASE_URL}/rest/v1/session_items?id=eq.${existing[0].id}`,
        {
          method: "PATCH",
          headers: { ...headers, Prefer: "return=minimal" },
          body: JSON.stringify(updateBody),
        }
      );
      if (!patchRes.ok) {
        console.error("[Cartify] addSessionItem PATCH failed:", patchRes.status, await patchRes.text());
        return false;
      }
      return true;
    } else {
      // Insert new item
      const domain = payload.product_url
        ? (() => { try { return new URL(payload.product_url).hostname.replace(/^www\./, ""); } catch { return null; } })()
        : null;

      const postRes = await fetchWithAutoRefresh(`${SUPABASE_URL}/rest/v1/session_items`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({
          session_id: sessionId,
          user_id: userId,
          product_url: payload.product_url,
          product_title: payload.product_title || null,
          product_image: payload.product_image || null,
          product_price: payload.product_price || null,
          retailer_domain: payload.retailer_domain || domain,
          interaction_type: interactionType,
          in_cart: inCart,
          tryon_request_id: tryonRequestId || null,
        }),
      });
      if (!postRes.ok) {
        console.error("[Cartify] addSessionItem POST failed:", postRes.status, await postRes.text());
        return false;
      }
    }
    return true;
  } catch (e) {
    console.error("[Cartify] addSessionItem error:", e);
    return false;
  }
}

// ── Message handler ──

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg?.type) return;

  if (msg.type === "AUTH_LOGIN") {
    // Fire-and-forget: respond immediately so the popup doesn't block
    // The popup detects auth completion via chrome.storage.onChanged
    chrome.storage.local.set({ cartify_auth_pending: true });
    doOAuthLogin(msg.provider || "google").then(() => {
      // Auth completed (success or failure) — clear pending flag
      chrome.storage.local.remove("cartify_auth_pending");
    });
    sendResponse({ ok: true, pending: true });
    return false;
  }

  if (msg.type === "AUTH_LOGOUT") {
    doLogout().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === "AUTH_GET_USER") {
    getAuthState().then(sendResponse);
    return true;
  }

  if (msg.type === "AUTH_REFRESH") {
    refreshToken().then((ok) => sendResponse({ ok }));
    return true;
  }

  if (msg.type === "CARTIFY_GET_AUTH") {
    getAuthState().then(sendResponse);
    return true;
  }

  if (msg.type === "CARTIFY_SESSION_FROM_WEB") {
    const { access_token, refresh_token, user } = msg.payload;
    chrome.storage.local.set(
      {
        cartify_auth_token: access_token,
        cartify_refresh_token: refresh_token,
        cartify_user: user,
      },
      () => {
        sendResponse({ ok: true });
        completeAuth({ ok: true });
      }
    );
    return true;
  }

  if (msg.type === "PRODUCT_DETECTED") {
    chrome.storage.local.set({ cartify_pending_product: msg.payload }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === "CARTIFY_TRYON_REQUEST") {
    const { payload, background } = msg;
    handleTryOn(payload, !!background).then(sendResponse);
    return true;
  }

  if (msg.type === "CARTIFY_ADD_TO_CART") {
    addSessionItem(msg.payload, "cart", true).then((ok) => {
      sendResponse({ ok });
    });
    return true;
  }

  if (msg.type === "CARTIFY_SAVE_PRODUCT") {
    addSessionItem(msg.payload, "saved").then((ok) => {
      sendResponse({ ok });
    });
    return true;
  }

  if (msg.type === "CARTIFY_CHECK_COUPONS") {
    (async () => {
      const headers = await getAuthHeaders();
      if (!headers) { sendResponse({ ok: false }); return; }
      try {
        const res = await fetchWithAutoRefresh(
          `${SUPABASE_URL}/rest/v1/retailer_coupons?domain=eq.${encodeURIComponent(msg.domain)}&is_active=eq.true&select=code,description,discount_type,discount_value,min_purchase`,
          { headers }
        );
        const coupons = await res.json();
        if (Array.isArray(coupons) && coupons.length > 0) {
          await chrome.storage.local.set({ cartify_active_coupons: coupons });
        } else {
          await chrome.storage.local.remove("cartify_active_coupons");
        }
        sendResponse({ ok: true, count: Array.isArray(coupons) ? coupons.length : 0 });
      } catch {
        sendResponse({ ok: false });
      }
    })();
    return true;
  }

  if (msg.type === "DISPLAY_MODE_CHANGED") {
    applyDisplayMode(msg.mode).then(() => sendResponse({ ok: true }));
    return true;
  }

  return false;
});

// ── Try-on handler ──

async function handleTryOn(payload: any, background = false): Promise<any> {
  try {
    const stored = await chrome.storage.local.get(["cartify_auth_token", "cartify_recent_tryons"]);
    let authToken = stored.cartify_auth_token;

    if (!authToken) {
      return { ok: false, error: "NOT_LOGGED_IN" };
    }

    // Proactively refresh expired token
    if (isTokenExpired(authToken)) {
      const refreshed = await refreshToken();
      if (!refreshed) {
        return { ok: false, error: "NOT_LOGGED_IN" };
      }
      const updated = await chrome.storage.local.get("cartify_auth_token");
      authToken = updated.cartify_auth_token;
      if (!authToken) return { ok: false, error: "NOT_LOGGED_IN" };
    }

    // Duplicate protection
    const recent: any[] = stored.cartify_recent_tryons || [];
    if (payload.product_url) {
      const now = Date.now();
      const duplicate = recent.find(
        (r) => r.product_url === payload.product_url && now - (r.timestamp || 0) < 60_000
      );
      if (duplicate) {
        return { ok: true, duplicate: true, tryOnId: duplicate.tryOnId };
      }
    }

    const tryOnBody = JSON.stringify({
      pageUrl: payload.product_url,
      imageUrl: payload.product_image,
      title: payload.product_title,
      category: payload.product_category || undefined,
    });

    let res = await fetch(`${SUPABASE_URL}/functions/v1/tryon-request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${authToken}`,
      },
      body: tryOnBody,
    });

    // Retry once on auth failure
    if (res.status === 401 || res.status === 403) {
      const refreshed = await refreshToken();
      if (refreshed) {
        const updated = await chrome.storage.local.get("cartify_auth_token");
        if (updated.cartify_auth_token) {
          res = await fetch(`${SUPABASE_URL}/functions/v1/tryon-request`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${updated.cartify_auth_token}`,
            },
            body: tryOnBody,
          });
        }
      }
    }

    let data: any;
    try {
      const text = await res.text();
      data = text ? JSON.parse(text) : {};
    } catch {
      return { ok: false, error: "Request timed out. Please try again." };
    }

    if (!res.ok) {
      return {
        ok: false,
        error: data.error || `HTTP ${res.status}`,
        missingPhoto: data.missingPhoto || undefined,
      };
    }

    const safeImageUrl =
      typeof data.resultImageUrl === "string" && data.resultImageUrl.startsWith("data:")
        ? null
        : data.resultImageUrl;

    const result = {
      tryOnId: data.tryOnId,
      resultImageUrl: safeImageUrl,
      product_url: payload.product_url,
      product_title: payload.product_title,
      timestamp: Date.now(),
    };

    recent.unshift(result);
    if (recent.length > 20) recent.length = 20;

    const storageUpdate: Record<string, any> = {
      cartify_recent_tryons: recent,
    };

    if (!background) {
      storageUpdate.cartify_last_result = result;
    }

    await chrome.storage.local.set(storageUpdate);

    // Also track in shopping session
    addSessionItem(payload, "tryon_requested", false, data.tryOnId).catch(() => {});

    return {
      ok: true,
      tryOnId: data.tryOnId,
      resultImageUrl: data.resultImageUrl,
    };
  } catch (e: any) {
    console.error("[Cartify background]", e);
    return { ok: false, error: e.message };
  }
}

// ── Lifecycle ──

chrome.runtime.onStartup.addListener(async () => {
  const result = await chrome.storage.local.get("cartify_display_mode");
  const mode = result.cartify_display_mode || "sidepanel";
  await applyDisplayMode(mode);
  await ensureTokenRefreshAlarm();
});

chrome.runtime.onInstalled.addListener(async () => {
  chrome.storage.local.remove(["cartify_last_result"]);

  const result = await chrome.storage.local.get("cartify_display_mode");
  const mode = result.cartify_display_mode || "sidepanel";
  if (!result.cartify_display_mode) {
    await chrome.storage.local.set({ cartify_display_mode: "sidepanel" });
  }
  await applyDisplayMode(mode);
  await ensureTokenRefreshAlarm();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.cartify_display_mode?.newValue) {
    applyDisplayMode(changes.cartify_display_mode.newValue);
  }
});

// ── Alarm handler ──

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === TOKEN_REFRESH_ALARM) {
    chrome.storage.local.get("cartify_auth_token", (result) => {
      if (result.cartify_auth_token) {
        refreshToken();
      }
    });
  }

  if (alarm.name === AUTH_TIMEOUT_ALARM) {
    completeAuth({ ok: false, error: "Sign-in timed out. Please try again." });
  }
});
