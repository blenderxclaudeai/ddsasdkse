/**
 * Content script that runs ONLY on the VTO web app domain.
 * After the user completes OAuth on the web app, this script
 * reads the Supabase session from localStorage and sends it
 * to the extension background for persistence.
 */

function getSupabaseSession() {
  // Try multiple key patterns — Lovable Cloud and standard Supabase
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    // Match any key that looks like a Supabase auth token store
    const isAuthKey =
      (key.startsWith("sb-") && key.endsWith("-auth-token")) ||
      key.includes("supabase") && key.includes("auth");

    if (isAuthKey) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.access_token) return parsed;
        }
      } catch {
        // ignore parse errors
      }
    }
  }
  return null;
}

function trySendSession() {
  const session = getSupabaseSession();
  if (!session?.access_token) return;

  const user = session.user;
  if (!user) return;

  chrome.runtime.sendMessage(
    {
      type: "VTO_SESSION_FROM_WEB",
      payload: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        user: {
          id: user.id,
          email: user.email,
          name:
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email,
          avatar_url: user.user_metadata?.avatar_url,
        },
      },
    },
    (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.ok) {
        showSyncBanner();
        setTimeout(() => window.close(), 1500);
      }
    }
  );
}

function showSyncBanner() {
  const banner = document.createElement("div");
  banner.style.cssText =
    "position:fixed;top:0;left:0;right:0;z-index:999999;background:#000;color:#fff;text-align:center;padding:12px;font-family:system-ui;font-size:14px;";
  banner.textContent = "Signed in to VTO extension — this tab will close shortly";
  document.body.appendChild(banner);
}

// Run immediately
trySendSession();

// Watch for storage changes (in case OAuth completes after script loads)
window.addEventListener("storage", (e) => {
  if (e.key) {
    trySendSession();
  }
});

// Poll briefly in case the session appears via onAuthStateChange
let attempts = 0;
const poll = setInterval(() => {
  attempts++;
  trySendSession();
  if (attempts > 30) clearInterval(poll); // stop after ~15s
}, 500);
