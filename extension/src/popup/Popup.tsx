import React, { useEffect, useState } from "react";
import { supabase } from "@ext/lib/supabase";
import type { User } from "@supabase/supabase-js";

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
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setRequests([]);
      return;
    }
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
    const fn =
      authMode === "login"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });
    const { error } = await fn;
    if (error) setAuthError(error.message);
  };

  const handleSignOut = () => supabase.auth.signOut();

  if (loading)
    return (
      <div style={styles.container}>
        <p>Loading…</p>
      </div>
    );

  if (!user) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>✨ VTO</h1>
        <form onSubmit={handleAuth} style={styles.form}>
          <input
            style={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {authError && <p style={styles.error}>{authError}</p>}
          <button style={styles.btn} type="submit">
            {authMode === "login" ? "Sign In" : "Sign Up"}
          </button>
          <button
            type="button"
            style={styles.link}
            onClick={() =>
              setAuthMode((m) => (m === "login" ? "signup" : "login"))
            }
          >
            {authMode === "login"
              ? "Need an account? Sign up"
              : "Have an account? Sign in"}
          </button>
        </form>
        <p style={styles.disclosure}>
          We may earn affiliate commission from purchases.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>✨ VTO</h1>
        <button style={styles.signOut} onClick={handleSignOut}>
          Sign Out
        </button>
      </div>
      <p style={styles.greeting}>Hi, {user.email}</p>
      <h2 style={styles.subtitle}>Recent Try-Ons</h2>
      {requests.length === 0 ? (
        <p style={styles.empty}>
          No try-ons yet. Visit a product page and click "Try On"!
        </p>
      ) : (
        <div style={styles.list}>
          {requests.map((r) => (
            <div key={r.id} style={styles.card}>
              {r.result_image_url && (
                <img
                  src={r.result_image_url}
                  alt="Try-on result"
                  style={styles.img}
                />
              )}
              <div style={styles.cardInfo}>
                <p style={styles.cardTitle}>{r.title || "Untitled"}</p>
                <p style={styles.cardStatus}>{r.status}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <p style={styles.disclosure}>
        We may earn affiliate commission from purchases.
      </p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: 360,
    minHeight: 400,
    padding: 16,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    background: "#0f0f14",
    color: "#e4e4e7",
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    margin: "0 0 12px",
    background: "linear-gradient(135deg, #7c3aed, #a78bfa)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  signOut: {
    background: "none",
    border: "none",
    color: "#a1a1aa",
    cursor: "pointer",
    fontSize: 12,
  },
  greeting: { fontSize: 13, color: "#a1a1aa", margin: "0 0 12px" },
  subtitle: { fontSize: 14, fontWeight: 600, margin: "0 0 8px" },
  empty: { fontSize: 13, color: "#71717a" },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  card: {
    display: "flex",
    gap: 8,
    background: "#1a1a24",
    borderRadius: 8,
    padding: 8,
    alignItems: "center",
  },
  img: { width: 48, height: 48, objectFit: "cover", borderRadius: 6 },
  cardInfo: { flex: 1, minWidth: 0 },
  cardTitle: {
    fontSize: 13,
    fontWeight: 500,
    margin: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  cardStatus: { fontSize: 11, color: "#a1a1aa", margin: "2px 0 0" },
  form: { display: "flex", flexDirection: "column", gap: 8 },
  input: {
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid #27272a",
    background: "#1a1a24",
    color: "#e4e4e7",
    fontSize: 13,
    outline: "none",
  },
  btn: {
    padding: "8px 12px",
    borderRadius: 6,
    border: "none",
    background: "#7c3aed",
    color: "#fff",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  },
  link: {
    background: "none",
    border: "none",
    color: "#a78bfa",
    cursor: "pointer",
    fontSize: 12,
    textAlign: "center" as const,
  },
  error: { fontSize: 12, color: "#ef4444", margin: 0 },
  disclosure: {
    fontSize: 10,
    color: "#52525b",
    textAlign: "center" as const,
    marginTop: 16,
  },
};
