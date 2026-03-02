import { supabase, SUPABASE_URL } from "./supabase";

/**
 * Launch OAuth via chrome.identity.launchWebAuthFlow.
 * Uses PKCE code exchange for secure token retrieval.
 */
export async function signInWithOAuth(provider: "google" | "apple") {
  const redirectUrl = chrome.identity.getRedirectURL("supabase");

  // Generate OAuth URL with PKCE — skipBrowserRedirect prevents auto-navigation
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      skipBrowserRedirect: true,
      redirectTo: redirectUrl,
    },
  });

  if (error || !data.url) {
    throw error || new Error("No OAuth URL returned");
  }

  // Open the OAuth consent screen in a Chrome-managed popup window
  const resultUrl = await new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: data.url, interactive: true },
      (responseUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!responseUrl) {
          reject(new Error("No response URL from auth flow"));
        } else {
          resolve(responseUrl);
        }
      }
    );
  });

  // Try PKCE code exchange first (modern Supabase default)
  const url = new URL(resultUrl);
  const code = url.searchParams.get("code");

  if (code) {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.exchangeCodeForSession(code);
    if (sessionError) throw sessionError;
    if (sessionData.session) {
      await persistSession(sessionData.session);
      return sessionData.session;
    }
    throw new Error("No session returned from code exchange");
  }

  // Fallback: parse tokens from hash fragment (implicit flow)
  const hashParams = new URLSearchParams(
    resultUrl.includes("#") ? resultUrl.split("#")[1] : ""
  );
  const access_token = hashParams.get("access_token");
  const refresh_token = hashParams.get("refresh_token");

  if (!access_token || !refresh_token) {
    throw new Error("No auth code or tokens found in OAuth response");
  }

  const { data: sessionData, error: sessionError } =
    await supabase.auth.setSession({ access_token, refresh_token });
  if (sessionError) throw sessionError;
  if (sessionData.session) {
    await persistSession(sessionData.session);
    return sessionData.session;
  }

  throw new Error("Failed to establish session");
}

async function persistSession(session: {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, any>;
  };
}) {
  await chrome.storage.local.set({
    vto_auth_token: session.access_token,
    vto_refresh_token: session.refresh_token,
    vto_user: {
      id: session.user.id,
      email: session.user.email,
      name:
        session.user.user_metadata?.full_name ||
        session.user.user_metadata?.name ||
        session.user.email,
      avatar_url: session.user.user_metadata?.avatar_url,
    },
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
  await supabase.auth.signOut();
  await chrome.storage.local.remove([
    "vto_auth_token",
    "vto_refresh_token",
    "vto_user",
    "vto_last_result",
  ]);
}
