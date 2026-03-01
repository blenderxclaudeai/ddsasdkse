import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "@/hooks/use-toast";

export default function Login() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/profile" replace />;

  const handleOAuth = async (provider: "google" | "apple") => {
    const { error } = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (error) toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <div className="flex h-[600px] w-[400px] flex-col justify-between overflow-hidden rounded-2xl border border-border bg-background p-8 shadow-sm">
        {/* Header */}
        <div className="space-y-1 pt-12 text-center">
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">VTO</h1>
          <p className="text-[14px] text-muted-foreground">Try before you buy</p>
        </div>

        {/* OAuth buttons */}
        <div className="space-y-3">
          <button
            onClick={() => handleOAuth("google")}
            className="w-full rounded-xl bg-foreground py-3.5 text-[14px] font-medium text-background transition-opacity hover:opacity-80"
          >
            Continue with Google
          </button>
          <button
            onClick={() => handleOAuth("apple")}
            className="w-full rounded-xl border border-border bg-background py-3.5 text-[14px] font-medium text-foreground transition-opacity hover:opacity-80"
          >
            Continue with Apple
          </button>
        </div>

        {/* Footer */}
        <div className="pb-2 text-center">
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
