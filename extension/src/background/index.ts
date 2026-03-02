// Background service worker — lightweight fetch to Supabase Edge Function

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // Auth check
  if (msg?.type === "VTO_GET_AUTH") {
    chrome.storage.local.get("vto_auth_token", (result) => {
      sendResponse({ loggedIn: !!result.vto_auth_token });
    });
    return true;
  }

  if (msg?.type !== "VTO_TRYON_REQUEST") return;

  const { payload } = msg;

  (async () => {
    try {
      // Get auth token
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
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        sendResponse({ ok: false, error: data.error || `HTTP ${res.status}` });
      } else {
        // Cache result for popup
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

  return true; // keep channel open for async sendResponse
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.remove(["vto_last_result"]);
});
