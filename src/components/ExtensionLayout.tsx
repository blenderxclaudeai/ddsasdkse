import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function ExtensionLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { user } = useAuth();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <div className="relative flex h-[600px] w-[400px] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        {/* Bottom tab bar */}
        <nav className="flex items-center justify-around border-t border-border px-2 py-3">
          <NavLink
            to="/profile"
            className={() =>
              `text-[13px] font-medium tracking-tight transition-opacity ${
                pathname === "/profile"
                  ? "text-foreground opacity-100"
                  : "text-muted-foreground opacity-60 hover:opacity-100"
              }`
            }
          >
            Profile
          </NavLink>
          <NavLink
            to="/showroom"
            className={() =>
              `text-[13px] font-medium tracking-tight transition-opacity ${
                pathname === "/showroom"
                  ? "text-foreground opacity-100"
                  : "text-muted-foreground opacity-60 hover:opacity-100"
              }`
            }
          >
            Showroom
          </NavLink>
          <button
            onClick={handleSignOut}
            className="text-[13px] font-medium tracking-tight text-muted-foreground opacity-60 transition-opacity hover:opacity-100"
          >
            Sign Out
          </button>
        </nav>
      </div>
    </div>
  );
}
