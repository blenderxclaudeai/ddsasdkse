import { NavLink, useLocation } from "react-router-dom";
import { Settings, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function ExtensionLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <div className="relative flex h-[600px] w-[400px] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        {/* Settings icon */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="absolute left-3 top-3 z-10 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              <Settings size={16} />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-40 p-1" sideOffset={4}>
            <button
              onClick={signOut}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </PopoverContent>
        </Popover>

        {/* Content */}
        <main className="scrollbar-hide flex-1 overflow-y-auto">
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
        </nav>
      </div>
    </div>
  );
}
