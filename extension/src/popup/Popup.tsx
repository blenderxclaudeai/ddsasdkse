import React, { useEffect, useState } from "react";
import { supabase } from "@ext/lib/supabase";
import type { User } from "@supabase/supabase-js";

/* ── Monochrome design system (inline, no Tailwind in popup) ── */
const c = {
  bg: "#ffffff",
  bgCard: "#fafafa",
  fg: "#171717",
  fgMuted: "#737373",
  fgDim: "#a3a3a3",
  border: "#e5e5e5",
  primary: "#171717",
  primaryFg: "#ffffff",
  danger: "#dc2626",
  accent: "#22c55e",
};

export function Popup() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      setLoading(false);
      // Store token for background worker
      if (data.session?.access_token) {
        chrome.storage.local.set({ vto_auth_token: data.session.access_token });
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      if (session?.access_token) {
        chrome.storage.local.set({ vto_auth_token: session.access_token });
      } else {
        chrome.storage.local.remove("vto_auth_token");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) { setRequests([]); return; }
    supabase
      .from("tryon_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setRequests(data ?? []));
  }, [user]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    const fn = authMode === "login"
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password });
    const { error } = await fn;
    if (error) setAuthError(error.message);
  };

  const handleSignOut = () => supabase.auth.signOut();

  if (loading) return <div style={s.container}><p style={{ color: c.fgMuted }}>Loading…</p></div>;

  /* ── Auth screen ── */
  if (!user) {
    return (
      <div style={s.container}>
        <div style={s.logoRow}>
          <span style={s.logo}>VTO</span>
          <span style={s.version}>v1.0</span>
        </div>
        <p style={{ ...s.subtitle, marginBottom: 16 }}>Virtual Try-On</p>
        <form onSubmit={handleAuth} style={s.form}>
          <input style={s.input} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input style={s.input} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          {authError && <p style={s.error}>{authError}</p>}
          <button style={s.btnPrimary} type="submit">
            {authMode === "login" ? "Sign In" : "Sign Up"}
          </button>
          <button type="button" style={s.link} onClick={() => setAuthMode(m => m === "login" ? "signup" : "login")}>
            {authMode === "login" ? "Need an account? Sign up" : "Have an account? Sign in"}
          </button>
        </form>
        <p style={s.disclosure}>We may earn affiliate commission from purchases.</p>
      </div>
    );
  }

  /* ── Logged-in dashboard ── */
  return (
    <div style={s.container}>
      <div style={s.header}>
        <div>
          <span style={s.logo}>VTO</span>
          <span style={{ ...s.subtitle, marginLeft: 8 }}>{user.email}</span>
        </div>
        <button style={s.btnGhost} onClick={handleSignOut}>Sign Out</button>
      </div>

      <div style={{ ...s.divider, margin: "12px 0" }} />

      <h2 style={s.sectionTitle}>Recent Try-Ons</h2>

      {requests.length === 0 ? (
        <p style={s.emptyText}>No try-ons yet. Visit a product page and click "Try On"!</p>
      ) : (
        <div style={s.list}>
          {requests.map(r => (
            <div key={r.id} style={s.card}>
              {r.result_image_url && (
                <img src={r.result_image_url} alt="Result" style={s.cardImg} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={s.cardTitle}>{r.title || "Untitled"}</p>
                <p style={s.cardMeta}>
                  <span style={{
                    display: "inline-block",
                    width: 6, height: 6,
                    borderRadius: "50%",
                    background: r.status === "completed" ? c.accent : c.fgDim,
                    marginRight: 4,
                    verticalAlign: "middle",
                  }} />
                  {r.status}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <p style={s.disclosure}>We may earn affiliate commission from purchases.</p>
    </div>
  );
}

/* ── Styles ── */
const s: Record<string, React.CSSProperties> = {
  container: {
    width: 380,
    minHeight: 420,
    padding: 20,
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif',
    background: c.bg,
    color: c.fg,
    fontSize: 13,
    lineHeight: 1.5,
  },
  logoRow: { display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 },
  logo: { fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em" },
  version: { fontSize: 11, color: c.fgDim, fontWeight: 500 },
  subtitle: { fontSize: 12, color: c.fgMuted, margin: 0 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  divider: { height: 1, background: c.border },
  sectionTitle: { fontSize: 13, fontWeight: 600, margin: "0 0 8px", letterSpacing: "-0.01em" },
  emptyText: { fontSize: 12, color: c.fgMuted, margin: 0 },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  card: {
    display: "flex", gap: 10, padding: 10, borderRadius: 10,
    background: c.bgCard, border: `1px solid ${c.border}`, alignItems: "center",
  },
  cardImg: { width: 44, height: 44, objectFit: "cover", borderRadius: 8, flexShrink: 0 },
  cardTitle: {
    fontSize: 13, fontWeight: 500, margin: 0,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  cardMeta: { fontSize: 11, color: c.fgMuted, margin: "2px 0 0" },
  form: { display: "flex", flexDirection: "column", gap: 8 },
  input: {
    padding: "9px 12px", borderRadius: 8, border: `1px solid ${c.border}`,
    background: c.bg, color: c.fg, fontSize: 13, outline: "none",
    transition: "border-color 0.15s",
  },
  btnPrimary: {
    padding: "9px 12px", borderRadius: 8, border: "none",
    background: c.primary, color: c.primaryFg, fontWeight: 600,
    fontSize: 13, cursor: "pointer", marginTop: 4,
  },
  btnGhost: {
    background: "none", border: "none", color: c.fgMuted,
    cursor: "pointer", fontSize: 12, fontWeight: 500, padding: "4px 8px",
  },
  link: {
    background: "none", border: "none", color: c.fgMuted,
    cursor: "pointer", fontSize: 12, textAlign: "center" as const,
    textDecoration: "underline",
  },
  error: { fontSize: 12, color: c.danger, margin: 0 },
  disclosure: {
    fontSize: 10, color: c.fgDim, textAlign: "center" as const, marginTop: 20,
  },
};
