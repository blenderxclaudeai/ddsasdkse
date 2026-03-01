import { NavLink, useLocation } from "react-router-dom";

export function ExtensionLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <div className="relative flex h-[600px] w-[400px] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        {/* Bottom tab bar — two tabs only */}
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
        </nav>
      </div>
    </div>
  );
}
