import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { lovable } from "@/integrations/lovable/index";

type Status = "redirecting" | "success" | "error" | "timeout";

export default function ExtensionAuth() {
  const [searchParams] = useSearchParams();
  const provider = searchParams.get("provider") as "google" | "apple" | null;
  const [status, setStatus] = useState<Status>("redirecting");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!provider || !["google", "apple"].includes(provider)) {
      setStatus("error");
      setErrorMsg("Invalid or missing provider.");
      return;
    }

    // Timeout: if OAuth hasn't completed in 2 minutes, show timeout
    const timeout = setTimeout(() => {
      setStatus((prev) => (prev === "redirecting" ? "timeout" : prev));
    }, 120_000);

    // Check if we already have a session (post-redirect)
    (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setStatus("success");
        clearTimeout(timeout);
        return;
      }

      // No session yet — kick off OAuth
      const { error } = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin + "/auth/extension?provider=" + provider,
      });

      if (error) {
        setStatus("error");
        setErrorMsg(error.message || "OAuth failed");
        clearTimeout(timeout);
      }
      // If no error, the page will redirect. On return, getSession above catches it.
    })();

    return () => clearTimeout(timeout);
  }, [provider]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Cartify</h1>

        {status === "redirecting" && (
          <div className="space-y-3">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
            <p className="text-sm text-muted-foreground">
              Signing you in with {provider === "apple" ? "Apple" : "Google"}…
            </p>
            <p className="text-xs text-muted-foreground/60">
              You'll be redirected back automatically.
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <span className="text-xl">✓</span>
            </div>
            <p className="text-sm font-medium text-foreground">Signed in successfully!</p>
            <p className="text-xs text-muted-foreground">
              Return to the Cartify extension. This tab will close automatically.
            </p>
          </div>
        )}

        {status === "timeout" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sign-in is taking longer than expected.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80"
            >
              Try again
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{errorMsg || "Something went wrong."}</p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
