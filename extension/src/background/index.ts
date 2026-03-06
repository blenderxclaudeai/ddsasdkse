/**
 * Background service worker — centralized auth manager + try-on requests.
 * All auth logic lives here. UI communicates via chrome.runtime.sendMessage.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const WEB_APP_URL = "https://ddsasdkse.lovable.app";

const TOKEN_REFRESH_ALARM = "cartify_token_refresh";
const AUTH_TIMEOUT_ALARM = "cartify_auth_timeout";

// Track pending auth tab so we can close it after session sync
let pendingAuthTabId: number | null = null;
let pendingAuthResolve: ((result: { ok: boolean; error?: string }) => void) | null = null;

// ── Alarm helper (idempotent, safe to call on every startup) ──

async function ensureTokenRefreshAlarm() {
  const existing = await chrome.alarms.get(TOKEN_REFRESH_ALARM);
  if (!existing) {
    await chrome.alarms.create(TOKEN_REFRESH_ALARM, { periodInMinutes: 45 });
  }
}

// Ensure alarm exists whenever service worker starts
ensureTokenRefreshAlarm().catch((e) =>
  console.warn("[Cartify] alarm init failed:", e)
);

// ── Auth helpers ──

async function doOAuthLogin(provider: "google" | "apple"): Promise<{ ok: boolean; error?: string }> {
  const authUrl = `${WEB_APP_URL}/auth/extension?provider=${provider}`;

  return new Promise((resolve) => {
    // Store resolve so CARTIFY_SESSION_FROM_WEB can complete it
    pendingAuthResolve = resolve;

    chrome.tabs.create({ url: authUrl, active: true }, (tab) => {
      if (chrome.runtime.lastError || !tab?.id) {
        pendingAuthResolve = null;
        resolve({ ok: false, error: chrome.runtime.lastError?.message || "Failed to open auth tab" });
        return;
      }
      pendingAuthTabId = tab.id;

      // Set a 2-minute timeout alarm
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
  const result = await chrome.storage.local.get(["cartify_auth_token", "cartify_user"]);
  return {
    loggedIn: !!result.cartify_auth_token,
    user: result.cartify_user || null,
  };
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

    if (!res.ok) return false;

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

// ── Helper: close auth tab + resolve pending promise ──

function completeAuth(result: { ok: boolean; error?: string }) {
  // Clear timeout alarm
  chrome.alarms.clear(AUTH_TIMEOUT_ALARM);

  // Close the auth tab
  if (pendingAuthTabId !== null) {
    try { chrome.tabs.remove(pendingAuthTabId); } catch {}
    pendingAuthTabId = null;
  }

  // Resolve the pending promise
  if (pendingAuthResolve) {
    pendingAuthResolve(result);
    pendingAuthResolve = null;
  }
}

// ── Display mode: dynamically toggle popup vs side panel (fail-safe) ──

async function applyDisplayMode(mode: "popup" | "sidepanel") {
  if (mode === "sidepanel") {
    const sidePanelSupported =
      !!(chrome.sidePanel && typeof (chrome.sidePanel as any).setPanelBehavior === "function");

    if (!sidePanelSupported) {
      console.log("[Cartify] Side Panel API not supported; reverting to popup.");
      await chrome.action.setPopup({ popup: "popup.html" });
      await chrome.storage.local.set({ cartify_display_mode: "popup" });
      return;
    }

    await chrome.action.setPopup({ popup: "" });
    try {
      await (chrome.sidePanel as any).setPanelBehavior({ openPanelOnActionClick: true });
    } catch (e) {
      console.log("[Cartify] setPanelBehavior failed; reverting to popup:", e);
      await chrome.action.setPopup({ popup: "popup.html" });
      await chrome.storage.local.set({ cartify_display_mode: "popup" });
    }
  } else {
    await chrome.action.setPopup({ popup: "popup.html" });
    try {
      if (chrome.sidePanel && typeof (chrome.sidePanel as any).setPanelBehavior === "function") {
        await (chrome.sidePanel as any).setPanelBehavior({ openPanelOnActionClick: false });
      }
    } catch (e) {
      console.log("[Cartify] setPanelBehavior not supported:", e);
    }
  }
}

// ── Message handler ──

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg?.type) return;

  if (msg.type === "AUTH_LOGIN") {
    const provider = msg.provider || "google";
    doOAuthLogin(provider).then(sendResponse);
    return true;
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

  // Legacy: CARTIFY_GET_AUTH (used by content scripts)
  if (msg.type === "CARTIFY_GET_AUTH") {
    getAuthState().then(sendResponse);
    return true;
  }

  // Session sync from web app content script (webAppSync.js)
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
        // Complete the pending auth flow — close tab + resolve promise
        completeAuth({ ok: true });
      }
    );
    return true;
  }

  // PRODUCT_DETECTED — store pending product from content script
  if (msg.type === "PRODUCT_DETECTED") {
    chrome.storage.local.set({ cartify_pending_product: msg.payload }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  // CARTIFY_TRYON_REQUEST
  if (msg.type === "CARTIFY_TRYON_REQUEST") {
    const { payload, background } = msg;
    handleTryOn(payload, !!background).then(sendResponse);
    return true;
  }

  // DISPLAY_MODE_CHANGED — apply popup/sidepanel toggle
  if (msg.type === "DISPLAY_MODE_CHANGED") {
    applyDisplayMode(msg.mode).then(() => sendResponse({ ok: true }));
    return true;
  }

  return false;
});

// ── Try-on handler ──

async function handleTryOn(payload: any): Promise<any> {
  try {
    const stored = await chrome.storage.local.get("cartify_auth_token");
    const authToken = stored.cartify_auth_token;

    if (!authToken) {
      return { ok: false, error: "NOT_LOGGED_IN" };
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/tryon-request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        pageUrl: payload.product_url,
        imageUrl: payload.product_image,
        title: payload.product_title,
        category: payload.product_category || undefined,
      }),
    });

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

    // Guard: never persist data URLs
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

    // Add to recent_tryons list (capped at 20)
    const existing = await chrome.storage.local.get("cartify_recent_tryons");
    const recent = existing.cartify_recent_tryons || [];
    recent.unshift(result);
    if (recent.length > 20) recent.length = 20;

    await chrome.storage.local.set({
      cartify_last_result: result,
      cartify_recent_tryons: recent,
    });

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

// Listen for display mode changes from storage
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
    // Auth timed out — close tab and reject
    completeAuth({ ok: false, error: "Sign-in timed out. Please try again." });
  }
});
