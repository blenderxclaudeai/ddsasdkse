/**
 * Background service worker — centralized auth manager + try-on requests.
 * All auth logic lives here. UI communicates via chrome.runtime.sendMessage.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const TOKEN_REFRESH_ALARM = "cartify_token_refresh";

// ── Alarm helper (idempotent, safe to call on every startup) ──

async function ensureTokenRefreshAlarm() {
  const existing = await chrome.alarms.get(TOKEN_REFRESH_ALARM);
  if (!existing) {
    await chrome.alarms.create(TOKEN_REFRESH_ALARM, { periodInMinutes: 45 });
  }
}

// Ensure alarm exists whenever service worker starts (alarms may be cleared on restart)
ensureTokenRefreshAlarm().catch((e) =>
  console.warn("[Cartify] alarm init failed:", e)
);

// ── Auth helpers ──

async function doOAuthLogin(provider: "google" | "apple"): Promise<{ ok: boolean; error?: string }> {
  const redirectUrl = chrome.identity.getRedirectURL("auth");

  const authUrl =
    `${SUPABASE_URL}/auth/v1/authorize?provider=${provider}` +
    `&redirect_to=${encodeURIComponent(redirectUrl)}`;

  return new Promise((resolve) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: true },
      async (callbackUrl) => {
        if (chrome.runtime.lastError || !callbackUrl) {
          resolve({ ok: false, error: chrome.runtime.lastError?.message || "Auth cancelled" });
          return;
        }

        try {
          const hashFragment = callbackUrl.split("#")[1];
          if (!hashFragment) {
            resolve({ ok: false, error: "No tokens in callback URL" });
            return;
          }

          const params = new URLSearchParams(hashFragment);
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");

          if (!access_token) {
            resolve({ ok: false, error: "No access token received" });
            return;
          }

          // Fetch user info
          const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${access_token}`,
            },
          });

          if (!userRes.ok) {
            resolve({ ok: false, error: "Failed to fetch user info" });
            return;
          }

          const userData = await userRes.json();
          const user = {
            id: userData.id,
            email: userData.email,
            name: userData.user_metadata?.full_name || userData.user_metadata?.name || userData.email,
            avatar_url: userData.user_metadata?.avatar_url,
          };

          await chrome.storage.local.set({
            cartify_auth_token: access_token,
            cartify_refresh_token: refresh_token,
            cartify_user: user,
          });

          resolve({ ok: true });
        } catch (e: any) {
          resolve({ ok: false, error: e.message || "Auth failed" });
        }
      }
    );
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

// ── Display mode: dynamically toggle popup vs side panel (fail-safe) ──

async function applyDisplayMode(mode: "popup" | "sidepanel") {
  if (mode === "sidepanel") {
    // Check if Side Panel API is available (Chrome 114+)
    const sidePanelSupported =
      !!(chrome.sidePanel && typeof (chrome.sidePanel as any).setPanelBehavior === "function");

    if (!sidePanelSupported) {
      console.log("[Cartify] Side Panel API not supported; reverting to popup.");
      await chrome.action.setPopup({ popup: "popup.html" });
      await chrome.storage.local.set({ cartify_display_mode: "popup" });
      return;
    }

    // Disable popup so action.onClicked fires, and enable side panel on click
    await chrome.action.setPopup({ popup: "" });
    try {
      await (chrome.sidePanel as any).setPanelBehavior({ openPanelOnActionClick: true });
    } catch (e) {
      console.log("[Cartify] setPanelBehavior failed; reverting to popup:", e);
      await chrome.action.setPopup({ popup: "popup.html" });
      await chrome.storage.local.set({ cartify_display_mode: "popup" });
    }
  } else {
    // Re-enable popup and disable side panel on click
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

  // Session sync from web app content script
  if (msg.type === "CARTIFY_SESSION_FROM_WEB") {
    const { access_token, refresh_token, user } = msg.payload;
    chrome.storage.local.set(
      {
        cartify_auth_token: access_token,
        cartify_refresh_token: refresh_token,
        cartify_user: user,
      },
      () => sendResponse({ ok: true })
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
    const { payload } = msg;
    handleTryOn(payload).then(sendResponse);
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

    // Store only metadata locally (URLs, not base64 blobs) to avoid exceeding 10 MB quota
    // Guard: never persist data URLs — they can be megabytes and blow the 10 MB quota
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

    // Add to recent_tryons list (capped at 20 entries of metadata only)
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

// Re-apply display mode on every service worker startup (browser restart, wake-up)
chrome.runtime.onStartup.addListener(async () => {
  const result = await chrome.storage.local.get("cartify_display_mode");
  const mode = result.cartify_display_mode || "popup";
  await applyDisplayMode(mode);
  await ensureTokenRefreshAlarm();
});

chrome.runtime.onInstalled.addListener(async () => {
  chrome.storage.local.remove(["cartify_last_result"]);

  // Set default display mode
  const result = await chrome.storage.local.get("cartify_display_mode");
  const mode = result.cartify_display_mode || "popup";
  if (!result.cartify_display_mode) {
    await chrome.storage.local.set({ cartify_display_mode: "popup" });
  }
  await applyDisplayMode(mode);

  // Ensure alarm exists (also called at top-level, but belt-and-suspenders)
  await ensureTokenRefreshAlarm();
});

// Listen for display mode changes from storage
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.cartify_display_mode?.newValue) {
    applyDisplayMode(changes.cartify_display_mode.newValue);
  }
});

// ── Alarm-based token refresh (MV3 safe) ──

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === TOKEN_REFRESH_ALARM) {
    chrome.storage.local.get("cartify_auth_token", (result) => {
      if (result.cartify_auth_token) {
        refreshToken();
      }
    });
  }
});
