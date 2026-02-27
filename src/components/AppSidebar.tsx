import { Home, User, Wallet, Shield, FileText, LogOut, Copy } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const navItems = [
  { title: "Dashboard", icon: Home, url: "/dashboard" },
  { title: "Profile", icon: User, url: "/profile" },
  { title: "Wallet", icon: Wallet, url: "/wallet" },
  { title: "Privacy", icon: FileText, url: "/privacy" },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, signOut, session } = useAuth();

  const copyToken = () => {
    if (session?.access_token) {
      navigator.clipboard.writeText(session.access_token);
      toast({ title: "Token copied", description: "JWT token copied to clipboard for extension pairing." });
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            V
          </div>
          <span className="text-lg font-bold tracking-tight">VTO</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    isActive={location.pathname === item.url}
                    onClick={() => navigate(item.url)}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={location.pathname === "/admin"}
                    onClick={() => navigate("/admin")}
                  >
                    <Shield className="h-4 w-4" />
                    <span>Admin</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 space-y-2">
        <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={copyToken}>
          <Copy className="h-3.5 w-3.5" />
          Copy Extension Token
        </Button>
        <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-destructive" onClick={signOut}>
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
