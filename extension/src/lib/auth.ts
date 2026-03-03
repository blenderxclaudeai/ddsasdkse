/**
 * Extension auth — uses chrome.identity.launchWebAuthFlow
 * for a fully in-extension OAuth experience (no external tabs).
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export async function signInWithOAuth(
  provider: "google" | "apple"
): Promise<{ ok: boolean; error?: string }> {
  const redirectUrl = chrome.identity.getRedirectURL();

  // Build the Supabase OAuth authorize URL
  const authUrl =
    `${SUPABASE_URL}/auth/v1/authorize?provider=${provider}` +
    `&redirect_to=${encodeURIComponent(redirectUrl)}`;

  return new Promise((resolve) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: true },
      async (callbackUrl) => {
        if (chrome.runtime.lastError || !callbackUrl) {
          resolve({
            ok: false,
            error: chrome.runtime.lastError?.message || "Auth cancelled",
          });
          return;
        }

        try {
          // Tokens are in the URL hash fragment: #access_token=...&refresh_token=...
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

          // Fetch user info from Supabase using the access token
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
            name:
              userData.user_metadata?.full_name ||
              userData.user_metadata?.name ||
              userData.email,
            avatar_url: userData.user_metadata?.avatar_url,
          };

          // Persist to chrome.storage.local
          await chrome.storage.local.set({
            vto_auth_token: access_token,
            vto_refresh_token: refresh_token,
            vto_user: user,
          });

          resolve({ ok: true });
        } catch (e: any) {
          resolve({ ok: false, error: e.message || "Auth failed" });
        }
      }
    );
  });
}

export async function getStoredUser(): Promise<{
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
} | null> {
  try {
    const result = await chrome.storage.local.get("vto_user");
    return result.vto_user || null;
  } catch {
    return null;
  }
}

export async function isLoggedIn(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get("vto_auth_token");
    return !!result.vto_auth_token;
  } catch {
    return false;
  }
}

export async function signOut() {
  await chrome.storage.local.remove([
    "vto_auth_token",
    "vto_refresh_token",
    "vto_user",
    "vto_last_result",
  ]);
}
