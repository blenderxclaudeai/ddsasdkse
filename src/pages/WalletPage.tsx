import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function WalletPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("wallet_ledger")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setEntries(data ?? []);
        setLoading(false);
      });
  }, [user]);

  const totals = entries.reduce(
    (acc, e) => {
      acc[e.status as string] = (acc[e.status as string] || 0) + Number(e.amount);
      return acc;
    },
    {} as Record<string, number>
  );

  const statusColor = (s: string) => {
    if (s === "available") return "default";
    if (s === "paid") return "secondary";
    return "outline";
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Wallet</h1>
          <p className="text-muted-foreground">Your cashback earnings</p>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}</div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              {(["pending", "available", "paid"] as const).map(s => (
                <Card key={s}>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium capitalize">{s}</CardTitle></CardHeader>
                  <CardContent><div className="text-2xl font-bold">${(totals[s] || 0).toFixed(2)}</div></CardContent>
                </Card>
              ))}
            </div>

            {entries.length > 0 ? (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map(e => (
                        <TableRow key={e.id}>
                          <TableCell className="text-sm">{new Date(e.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="text-sm">{e.description || "Cashback"}</TableCell>
                          <TableCell className="text-sm font-medium">${Number(e.amount).toFixed(2)}</TableCell>
                          <TableCell><Badge variant={statusColor(e.status)}>{e.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No wallet entries yet. Use VTO to earn cashback!</CardContent></Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
