// Background service worker — handles auth persistence + try-on requests

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // Auth check
  if (msg?.type === "VTO_GET_AUTH") {
    chrome.storage.local.get(["vto_auth_token", "vto_user"], (result) => {
      sendResponse({
        loggedIn: !!result.vto_auth_token,
        user: result.vto_user || null,
      });
    });
    return true;
  }

  // Session sync from web app content script
  if (msg?.type === "VTO_SESSION_FROM_WEB") {
    const { access_token, refresh_token, user } = msg.payload;
    chrome.storage.local.set(
      {
        vto_auth_token: access_token,
        vto_refresh_token: refresh_token,
        vto_user: user,
      },
      () => {
        sendResponse({ ok: true });
      }
    );
    return true;
  }

  // Try-on request
  if (msg?.type !== "VTO_TRYON_REQUEST") return;

  const { payload } = msg;

  (async () => {
    try {
      const stored = await chrome.storage.local.get("vto_auth_token");
      const authToken = stored.vto_auth_token;

      if (!authToken) {
        sendResponse({ ok: false, error: "NOT_LOGGED_IN" });
        return;
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

      const data = await res.json();

      if (!res.ok) {
        sendResponse({
          ok: false,
          error: data.error || `HTTP ${res.status}`,
          missingPhoto: data.missingPhoto || undefined,
        });
      } else {
        chrome.storage.local.set({
          vto_last_result: {
            ...data,
            product_url: payload.product_url,
            product_title: payload.product_title,
            timestamp: Date.now(),
          },
        });
        sendResponse({
          ok: true,
          tryOnId: data.tryOnId,
          resultImageUrl: data.resultImageUrl,
        });
      }
    } catch (e: any) {
      console.error("[VTO background]", e);
      sendResponse({ ok: false, error: e.message });
    }
  })();

  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.remove(["vto_last_result"]);
});
