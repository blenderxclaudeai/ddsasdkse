import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Camera, Shirt, Wallet } from "lucide-react";

const CATEGORIES = ["full_body", "face", "hair", "hands_wrist"] as const;

export default function Dashboard() {
  const { user } = useAuth();
  const [photoCount, setPhotoCount] = useState(0);
  const [recentTryons, setRecentTryons] = useState<any[]>([]);
  const [pendingCashback, setPendingCashback] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [photos, tryons, wallet] = await Promise.all([
        supabase.from("profile_photos").select("category").eq("user_id", user.id),
        supabase.from("tryon_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(6),
        supabase.from("wallet_ledger").select("amount").eq("user_id", user.id).eq("status", "pending"),
      ]);
      setPhotoCount(photos.data?.length ?? 0);
      setRecentTryons(tryons.data ?? []);
      setPendingCashback(wallet.data?.reduce((sum, e) => sum + Number(e.amount), 0) ?? 0);
      setLoading(false);
    };
    load();
  }, [user]);

  const completeness = Math.round((photoCount / CATEGORIES.length) * 100);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Your VTO overview</p>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Profile Completeness</CardTitle>
                <Camera className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{completeness}%</div>
                <Progress value={completeness} className="mt-2" />
                <p className="mt-1 text-xs text-muted-foreground">{photoCount}/{CATEGORIES.length} photos uploaded</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Recent Try-Ons</CardTitle>
                <Shirt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{recentTryons.length}</div>
                <p className="text-xs text-muted-foreground">Latest requests</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pending Cashback</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${pendingCashback.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Awaiting approval</p>
              </CardContent>
            </Card>
          </div>
        )}

        {recentTryons.length > 0 && (
          <div>
            <h2 className="mb-3 text-lg font-semibold">Recent Try-Ons</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recentTryons.map(t => (
                <Card key={t.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <p className="font-medium truncate">{t.title || "Untitled"}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.retailer_domain}</p>
                    <p className="mt-1 text-xs">{t.price && `${t.price} · `}{t.status}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
