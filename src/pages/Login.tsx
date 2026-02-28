import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "@/hooks/use-toast";

export default function Login() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/profile" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      if (error) toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
      else toast({ title: "Check your email", description: "We sent you a confirmation link." });
    }
    setSubmitting(false);
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    const { error } = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (error) toast({ title: "OAuth failed", description: error.message, variant: "destructive" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <div className="flex h-[600px] w-[400px] flex-col justify-between overflow-hidden rounded-2xl border border-border bg-background p-8 shadow-sm">
        {/* Header */}
        <div className="space-y-1 pt-8 text-center">
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">VTO</h1>
          <p className="text-[14px] text-muted-foreground">Virtual Try-On</p>
        </div>

        {/* Form */}
        <div className="flex-1 flex flex-col justify-center space-y-5">
          <button
            onClick={() => handleOAuth("google")}
            className="w-full rounded-xl bg-primary py-3 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-80"
          >
            Continue with Google
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[12px] text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border-0 bg-secondary px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-transparent transition-all focus:ring-1 focus:ring-foreground/20"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl border-0 bg-secondary px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-transparent transition-all focus:ring-1 focus:ring-foreground/20"
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-primary py-3 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {mode === "signin" ? "Sign In" : "Sign Up"}
            </button>
          </form>

          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="text-[13px] text-muted-foreground transition-opacity hover:opacity-70"
          >
            {mode === "signin" ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
          </button>
        </div>

        {/* Footer */}
        <div className="text-center">
          <a
            href="/privacy-policy.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-muted-foreground/60 transition-opacity hover:opacity-70"
          >
            Privacy Policy & Terms
          </a>
        </div>
      </div>
    </div>
  );
}
