import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2 } from "lucide-react";

export default function AdminPage() {
  const [merchants, setMerchants] = useState<any[]>([]);
  const [pendingEntries, setPendingEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMerchant, setNewMerchant] = useState({ domain: "", network: "", affiliate_link_template: "", commission_rate: "" });

  const loadData = async () => {
    const [m, w] = await Promise.all([
      supabase.from("affiliate_merchants").select("*").order("created_at", { ascending: false }),
      supabase.from("wallet_ledger").select("*, profiles(display_name)").eq("status", "pending").order("created_at", { ascending: false }),
    ]);
    setMerchants(m.data ?? []);
    setPendingEntries(w.data ?? []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const addMerchant = async () => {
    if (!newMerchant.domain) return;
    const { error } = await supabase.from("affiliate_merchants").insert({
      domain: newMerchant.domain,
      network: newMerchant.network || null,
      affiliate_link_template: newMerchant.affiliate_link_template || null,
      commission_rate: newMerchant.commission_rate ? parseFloat(newMerchant.commission_rate) : null,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Merchant added" });
      setNewMerchant({ domain: "", network: "", affiliate_link_template: "", commission_rate: "" });
      loadData();
    }
  };

  const deleteMerchant = async (id: string) => {
    await supabase.from("affiliate_merchants").delete().eq("id", id);
    toast({ title: "Merchant deleted" });
    loadData();
  };

  const approveCashback = async (id: string) => {
    const { error } = await supabase.from("wallet_ledger").update({ status: "available" as any }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Cashback approved" }); loadData(); }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
          <p className="text-muted-foreground">Manage merchants and cashback</p>
        </div>

        {loading ? <Skeleton className="h-64" /> : (
          <Tabs defaultValue="merchants">
            <TabsList><TabsTrigger value="merchants">Merchants</TabsTrigger><TabsTrigger value="cashback">Pending Cashback</TabsTrigger></TabsList>

            <TabsContent value="merchants" className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Add Merchant</CardTitle></CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <div><Label>Domain</Label><Input placeholder="zalando.se" value={newMerchant.domain} onChange={e => setNewMerchant(p => ({ ...p, domain: e.target.value }))} /></div>
                  <div><Label>Network</Label><Input placeholder="tradedoubler" value={newMerchant.network} onChange={e => setNewMerchant(p => ({ ...p, network: e.target.value }))} /></div>
                  <div><Label>Link Template</Label><Input placeholder="https://..." value={newMerchant.affiliate_link_template} onChange={e => setNewMerchant(p => ({ ...p, affiliate_link_template: e.target.value }))} /></div>
                  <div><Label>Commission %</Label><Input type="number" step="0.01" value={newMerchant.commission_rate} onChange={e => setNewMerchant(p => ({ ...p, commission_rate: e.target.value }))} /></div>
                  <Button onClick={addMerchant} className="sm:col-span-2"><Plus className="mr-1 h-4 w-4" />Add Merchant</Button>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead>Domain</TableHead><TableHead>Network</TableHead><TableHead>Commission</TableHead><TableHead></TableHead></TableRow></TableHeader>
                    <TableBody>
                      {merchants.map(m => (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium">{m.domain}</TableCell>
                          <TableCell>{m.network || "—"}</TableCell>
                          <TableCell>{m.commission_rate ? `${m.commission_rate}%` : "—"}</TableCell>
                          <TableCell><Button variant="ghost" size="icon" onClick={() => deleteMerchant(m.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                        </TableRow>
                      ))}
                      {merchants.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No merchants configured</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cashback" className="space-y-4">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Amount</TableHead><TableHead>Date</TableHead><TableHead></TableHead></TableRow></TableHeader>
                    <TableBody>
                      {pendingEntries.map(e => (
                        <TableRow key={e.id}>
                          <TableCell>{(e as any).profiles?.display_name || "Unknown"}</TableCell>
                          <TableCell className="font-medium">${Number(e.amount).toFixed(2)}</TableCell>
                          <TableCell>{new Date(e.created_at).toLocaleDateString()}</TableCell>
                          <TableCell><Button size="sm" onClick={() => approveCashback(e.id)}>Approve</Button></TableCell>
                        </TableRow>
                      ))}
                      {pendingEntries.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No pending entries</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
