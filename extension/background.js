// VTO Background Service Worker (MV3)

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "TRYON_REQUEST") {
    console.log("[VTO background] Try-on request received:", msg.payload);

    // Placeholder: call Supabase Edge Function tryon-request
    // Uncomment and set SUPABASE_URL / SUPABASE_ANON_KEY to enable
    /*
    const SUPABASE_URL = "https://yidfawmlhjltclnzfyuz.supabase.co";
    const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";
    fetch(SUPABASE_URL + "/functions/v1/tryon-request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY
      },
      body: JSON.stringify(msg.payload)
    })
    .then(r => r.json())
    .then(data => { console.log("[VTO background] result:", data); sendResponse({ ok: true, data }); })
    .catch(err => { console.error("[VTO background] error:", err); sendResponse({ ok: false, error: err.message }); });
    return true; // keep channel open for async
    */

    sendResponse({ ok: true });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("[VTO background] Extension installed.");
  chrome.storage.local.remove("vto_last_result");
});
