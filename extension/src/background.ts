// Background service worker — uses direct fetch (no heavy SDK in worker context)

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "TRYON_REQUEST") return;

  (async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/tryon-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          pageUrl: msg.payload.product_url,
          imageUrl: msg.payload.product_image,
          title: msg.payload.product_title,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        sendResponse({ ok: false, error: data.error || "Request failed" });
      } else {
        chrome.storage.local.set({ vto_last_result: data });
        sendResponse({ ok: true, data });
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
