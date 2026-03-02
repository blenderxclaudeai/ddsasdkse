// Auth helpers for background / content communication

export async function getStoredAuthToken(): Promise<string | null> {
  try {
    const result = await chrome.storage.local.get("vto_auth_token");
    return result.vto_auth_token || null;
  } catch {
    return null;
  }
}

export async function isLoggedIn(): Promise<boolean> {
  const token = await getStoredAuthToken();
  return !!token;
}
